var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { radix, delay } from "./util";
import fs from 'fs';
import { promisify } from 'util';
import * as yaml from 'yaml';
import { state } from './state';
import path from "path";
import * as core from '@actions/core';
const readFile = promisify(fs.readFile);
let appName;
let env;
export function setSecrets() {
    return __awaiter(this, void 0, void 0, function* () {
        const { vault, name: environment } = state.options;
        const buf = yield readFile(state.environment.RADIX_FILE);
        const yml = buf.toString();
        const radixConfig = yaml.parse(yml, { prettyErrors: true });
        appName = radixConfig.metadata.name;
        env = environment;
        // Build the URL to reach your key vault
        const url = `https://${vault}.vault.azure.net`;
        // Lastly, create our secrets client and connect to the service
        const credential = new DefaultAzureCredential();
        const client = new SecretClient(url, credential);
        let hasSecretFile;
        for (let c of radixConfig.spec.components) {
            yield setSecretsForComponent(c.name, client, c.secrets);
        }
    });
}
function setSecretsForComponent(component, client, secrets = []) {
    return __awaiter(this, void 0, void 0, function* () {
        let secretVaultMapping = {};
        try {
            const file = yield readFile(path.join(state.options.context, './secret-map.json'));
            const json = JSON.parse(file.toString());
            secretVaultMapping = json[component] || {};
        }
        catch (_a) {
            secretVaultMapping = {};
        }
        const secretMap = new Map();
        for (let name of secrets) {
            let value;
            try {
                value = yield loadSecret(secretVaultMapping[name] || name, client);
            }
            catch (ex) {
                core.warning(`${secretVaultMapping[name] || name} not found in keyvault, setting fallback value. Exception below.`);
                core.warning(ex);
                value = 'FALLBACK_SECRET';
            }
            secretMap.set(name, value);
        }
        for (const k of Array.from(secretMap.keys())) {
            const val = secretMap.get(k);
            yield updateRadixSecret(component, k, val);
        }
    });
}
function updateRadixSecret(component, secretName, secretValue) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield radix.environment().changeEnvironmentComponentSecret(appName, env, component, secretName, { secretValue });
        const status = res.status;
        if (status >= 200 && status < 400) {
            return true;
        }
        const error = yield res.text();
        console.error(`Failed to update secret ${secretName}: ${error}`);
        return false;
    });
}
function loadSecret(query, client) {
    return __awaiter(this, void 0, void 0, function* () {
        let value;
        try {
            const secret = yield client.getSecret(query);
            value = secret.value;
        }
        catch (ex) {
            core.warning(`Failed to load secret ${query} from az kv: ${ex}`);
            core.warning('Setting fallback secret value = FALLBACK');
            value = 'FALLBACK';
        }
        return value;
    });
}
let attempts = 0;
// Function to ensure we wait until the radix environment is created before proceeding. Default wait is 10 ms.
export function waitForEnvironment(wait = 10) {
    return __awaiter(this, void 0, void 0, function* () {
        yield delay(wait);
        try {
            yield radix.environment().getEnvironment(appName, env);
        }
        catch (_a) {
            if (attempts > 12) {
                throw new Error('Radix environment took more than 120 seconds to create, bailing.');
            }
            else {
                attempts = attempts + 1;
                return waitForEnvironment(10000);
            }
        }
        return true;
    });
}
