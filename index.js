import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ora from 'ora';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  debug: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '🔍  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.blue('DEBUG');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

function printProfileInfo(userId, email, points, status, context) {
  printHeader(`Profile Info ${context}`);
  printInfo('User ID', userId, context);
  printInfo('Email', email, context);
  printInfo('Total Points', points.toString(), context);
  printInfo('Status', status, context);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getAxiosConfig(proxy, additionalHeaders = {}) {
  const headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7,fr;q=0.6,ru;q=0.5,zh-CN;q=0.4,zh;q=0.3',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://aithereumnetwork.com/',
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Opera";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': getRandomUserAgent(),
    ...additionalHeaders
  };
  const config = {
    headers,
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return response;
    } catch (error) {
      if (error.response && error.response.status >= 500 && i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries}) due to server error`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      if (i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

async function readUsers() {
  try {
    const data = await fs.readFile('user.txt', 'utf-8');
    const users = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (users.length === 0) {
      throw new Error('user.txt is empty');
    }
    logger.info(`Loaded ${users.length} user${users.length === 1 ? '' : 's'}`, { emoji: '🔑 ' });
    return users;
  } catch (error) {
    logger.error(`Failed to read user.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️ ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐 ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = getAxiosConfig(proxy);
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.data.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌ ', context });
    return 'Error retrieving IP';
  }
}

async function fetchUserInfo(userId, proxy, context) {
  const url = `https://api.aithereumnetwork.com/api/users/${userId}`;
  const config = getAxiosConfig(proxy);
  const spinner = ora({ text: 'Fetching user info...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success && response.data.data) {
      return response.data.data;
    } else {
      throw new Error('Failed to fetch user info or invalid response');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch user info: ${error.message}`));
    logger.error(`Error: ${error.message}`, { context });
    return null;
  }
}

async function executeDailyCheckin(userId, proxy, context) {
  const url = 'https://api.aithereumnetwork.com/api/tasks/complete';
  const payload = {
    userId: userId,
    taskType: 'daily_checkin',
    taskName: 'Daily Check-in'
  };
  const config = getAxiosConfig(proxy, { 'Content-Type': 'application/json' });
  config.validateStatus = (status) => status >= 200 && status < 500;
  const spinner = ora({ text: 'Executing daily check-in...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Check-In Successfully! +${response.data.reward} points`));
      return { success: true, data: response.data };
    } else {
      throw new Error(response.data.message || 'Check-in failed');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to execute check-in: ${error.message}`));
    return { success: false };
  }
}

async function processUser(userId, index, total, proxy) {
  const context = `User ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting user processing`), { emoji: '🚀 ', context });

  printHeader(`User Info ${context}`);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP', ip, context);

  let userInfo = await fetchUserInfo(userId, proxy, context);
  if (!userInfo) {
    logger.error('Failed to fetch user info. Skipping.', { emoji: '❌ ', context });
    return;
  }

  let email = userInfo.email || 'N/A';
  printInfo('Email', email, context);
  console.log('\n');

  logger.info('Starting Checkin Process...', { emoji: '🛎️ ', context });

  let status = userInfo.isBanned ? 'Banned' : 'Secure';
  let points = userInfo.afdTokens || 0;

  if (userInfo.isBanned) {
    logger.error('User is banned!', { emoji: '❌ ', context });
    printProfileInfo(userId, email, points, status, context);
    return;
  }

  const todayTasks = userInfo.todayTasks || [];
  const hasDailyCheckin = todayTasks.some(task => task.taskType === 'daily_checkin');

  let finalUserInfo = userInfo;
  if (hasDailyCheckin) {
    logger.warn(chalk.bold.yellowBright('Already checked in today!'), { emoji: '⚠️ ', context });
  } else {
    const checkinResult = await executeDailyCheckin(userId, proxy, context);
    if (checkinResult && checkinResult.success) {
      await delay(3);
      finalUserInfo = await fetchUserInfo(userId, proxy, context);
      if (finalUserInfo) {
        status = finalUserInfo.isBanned ? 'Banned' : 'Secure';
        points = finalUserInfo.afdTokens || 0;
        email = finalUserInfo.email || 'N/A';
      }
    }
  }

  printProfileInfo(userId, email, points, status, context);

  logger.info(chalk.bold.greenBright(`Completed user processing`), { emoji: '🎉 ', context });
  console.log(chalk.cyanBright('________________________________________________________________________________'));
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want to Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function runCycle() {
  const users = await readUsers();
  if (users.length === 0) {
    logger.error('No users found in user.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < users.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processUser(users[i], i, users.length, proxy);
    } catch (error) {
      logger.error(`Error processing user: ${error.message}`, { emoji: '❌ ', context: `User ${i + 1}/${users.length}` });
    }
    if (i < users.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NT EXHAUST', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('=== Telegram Channel 🚀 : NT Exhaust (@NTExhaust) ===', terminalWidth)));
  console.log(gradient.retro(centerText('✪ BOT AITHEREUM AUTO CHECK-IN ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    console.log();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));