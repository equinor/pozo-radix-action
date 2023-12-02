var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetch from 'node-fetch';
import { state } from './state';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { Radix } from '@ngx-stoui/radix-api';
export function delay(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
process.env.API_URL = process.env.API_URL || 'https://api.radix.equinor.com/api/v1';
export const radix = new Radix(process.env.RADIX_TOKEN);
export function callRadix(path, config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${state.environment.RADIX_API}/${path}`;
        return fetch(url, Object.assign(Object.assign({}, config), { headers: Object.assign(Object.assign({}, (config.headers || {})), { Authorization: `Bearer ${state.environment.RADIX_TOKEN}` }) }));
    });
}
export function log(message) {
    if (message instanceof Array) {
        message = message.join(' ');
    }
    if (github.context.eventName) {
        core.info(message);
    }
    else {
        console.log(message);
    }
}
