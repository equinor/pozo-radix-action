var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import * as yaml from 'yaml';
import fs from 'fs';
import { promisify } from 'util';
import { radix } from './util';
import { DefaultAzureCredential } from "@azure/identity";
import { ContainerRegistryClient } from "@azure/container-registry";
import { state } from './state';
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
export function teardownEnvironment() {
    return __awaiter(this, void 0, void 0, function* () {
        const { name: env } = state.options;
        const kubeEnvironmentRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])$/;
        const envIsValid = kubeEnvironmentRegex.test(env);
        if (!envIsValid) {
            throw new Error(`Invalid environment name: ${env} (must match pattern ${kubeEnvironmentRegex.source})`);
        }
        const buf = yield readFile(state.environment.RADIX_FILE);
        const d = buf.toString();
        const obj = yaml.parse(d);
        obj.spec.environments = obj.spec.environments.filter(e => e.name !== env);
        obj.spec.components = obj.spec.components.map(comp => {
            const environmentConfig = comp.environmentConfig.filter(e => e.environment !== env);
            return Object.assign(Object.assign({}, comp), { environmentConfig });
        });
        try {
            yield deleteImageTags(env);
        }
        catch (_a) { }
        // Wont work - radix requires removing in .yml first.
        // await teardownInRadix(env, appName);
        yield updateConfig(obj);
    });
}
function deleteImageTags(env) {
    var _a, e_1, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        if (!state.options.registry) {
            return;
        }
        const endpoint = `https://${state.options.registry}`;
        // Create a ContainerRegistryClient that will authenticate through Active Directory
        const client = new ContainerRegistryClient(endpoint, new DefaultAzureCredential());
        const iterator = client.listRepositories();
        try {
            for (var _d = true, iterator_1 = __asyncValues(iterator), iterator_1_1; iterator_1_1 = yield iterator_1.next(), _a = iterator_1_1.done, !_a; _d = true) {
                _c = iterator_1_1.value;
                _d = false;
                const repository = _c;
                const repoClient = client.getRepositoryClient(repository);
                let props;
                try {
                    props = yield repoClient.getTagProperties(env);
                }
                catch (_e) { }
                if (props && props.writeableProperties.canDelete) {
                    yield repoClient.deleteTag(env);
                    console.log(`Deleted ${props.repository}/${props.name}`);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = iterator_1.return)) yield _b.call(iterator_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
}
function teardownInRadix(env, appName) {
    return __awaiter(this, void 0, void 0, function* () {
        const status = yield radix.environment().deleteEnvironment(appName, env)
            .then(r => r.status);
        console.log(status);
    });
}
function updateConfig(obj) {
    return __awaiter(this, void 0, void 0, function* () {
        const doc = new yaml.Document();
        doc.setSchema();
        doc.contents = doc.schema.createNode(obj);
        const toYaml = String(doc);
        yield writeFile(state.environment.RADIX_FILE, toYaml, 'utf8');
    });
}
