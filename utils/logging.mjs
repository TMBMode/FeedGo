import { getTime } from "./functions.mjs";

export const _log = console.log;
console.log = debug;

const isDebug = eval(process.env.DEBUG) ?? true;
info(`Debug: ${isDebug}`);

const reset = '\x1b[0m',
      bright = '\x1b[1m',
      yellow = '\x1b[33m',
      red = '\x1b[31m',
      green = '\x1b[32m',
      cyan = '\x1b[36m';

function info(text) {
  _log(`[${getTime()}] INFO | ${text}`);
}

function warn(text) {
  _log(`${bright}${yellow}[${getTime()}] WARNING | ${text}${reset}`);
}

function error(text) {
  _log(`${bright}${red}[${getTime()}] ERROR | ${text}${reset}`);
}

function notice(text) {
  _log(`${bright}${green}[${getTime()}] NOTICE | ${text}${reset}`);
}

function debug(text) {
  isDebug &&
  _log(`${bright}${cyan}[${getTime()}] DEBUG | ${text}${reset}`);
}

export const log = {
  info, warn, error, notice, debug
};

export const color = {
  reset, bright, yellow, red, green, cyan
};