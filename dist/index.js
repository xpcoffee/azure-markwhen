#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const azdev = __importStar(require("azure-devops-node-api"));
const witApi = __importStar(require("azure-devops-node-api/interfaces/WorkItemTrackingInterfaces"));
const msRestNodeAuth = __importStar(require("@azure/ms-rest-nodeauth"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error("Usage: azure-markwhen <work-item-id>");
    process.exit(1);
}
const workItemId = args[0];
const tokenFilePath = path.join(__dirname, '.token');
function fetchWorkItems(workItemId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const orgUrl = 'https://dev.azure.com/cur8'; // Replace 'cur8' with your actual organization name
            let token = yield getToken();
            let authHandler = azdev.getBearerHandler(token);
            let connection = new azdev.WebApi(orgUrl, authHandler);
            let workItemTrackingApi;
            try {
                workItemTrackingApi = yield connection.getWorkItemTrackingApi();
                const workItem = yield workItemTrackingApi.getWorkItem(parseInt(workItemId), undefined, undefined, witApi.WorkItemExpand.Relations);
                const markWhenEntries = yield transformToMarkWhen(workItemTrackingApi, workItem);
                console.log(markWhenEntries);
            }
            catch (error) {
                if (error !== null && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.includes("is not authorized to access this resource")) {
                    console.error("Authentication error, re-authenticating...");
                    token = yield reAuthenticate();
                    authHandler = azdev.getBearerHandler(token);
                    connection = new azdev.WebApi(orgUrl, authHandler);
                    workItemTrackingApi = yield connection.getWorkItemTrackingApi();
                    const workItem = yield workItemTrackingApi.getWorkItem(parseInt(workItemId), undefined, undefined, witApi.WorkItemExpand.Relations);
                    const markWhenEntries = yield transformToMarkWhen(workItemTrackingApi, workItem);
                    console.log(markWhenEntries);
                }
                else {
                    throw error;
                }
            }
        }
        catch (error) {
            console.error("Error fetching work items:", typeof error === "object" && error !== null && "message" in error ? error.message : error);
            if (error instanceof Error) {
                console.error(error.stack);
            }
        }
    });
}
function getToken() {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs.existsSync(tokenFilePath)) {
            return fs.readFileSync(tokenFilePath, 'utf8');
        }
        else {
            return yield reAuthenticate();
        }
    });
}
function reAuthenticate() {
    return __awaiter(this, void 0, void 0, function* () {
        const credentials = yield msRestNodeAuth.interactiveLogin();
        const token = (yield credentials.getToken()).accessToken;
        fs.writeFileSync(tokenFilePath, token, 'utf8');
        return token;
    });
}
function transformToMarkWhen(workItemTrackingApi, workItem) {
    return __awaiter(this, void 0, void 0, function* () {
        const today = new Date();
        const twoDaysFromToday = new Date(today);
        twoDaysFromToday.setDate(today.getDate() + 2);
        const formatWorkItem = (item) => {
            var _a, _b, _c;
            const title = ((_a = item.fields) === null || _a === void 0 ? void 0 : _a['System.Title']) || 'No Title';
            const assignedTo = ((_c = (_b = item.fields) === null || _b === void 0 ? void 0 : _b['System.AssignedTo']) === null || _c === void 0 ? void 0 : _c.displayName) || 'Unassigned';
            if (getWorkItemType(item) !== "Task") {
                return `${title} #${removeSpace(assignedTo)}`;
            }
            return `0 days: ${title} #${removeSpace(assignedTo)}`;
        };
        const removeSpace = (item) => {
            return item.replace(" ", "_");
        };
        const getWorkItemType = (item) => {
            var _a;
            return ((_a = item.fields) === null || _a === void 0 ? void 0 : _a['System.WorkItemType']) || 'Unknown';
        };
        const isClosed = (item) => {
            var _a;
            const state = ((_a = item.fields) === null || _a === void 0 ? void 0 : _a['System.State']) || 'Unknown';
            return state.toLowerCase() === 'closed';
        };
        const fetchChildren = (item) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const childIds = ((_b = (_a = item.relations) === null || _a === void 0 ? void 0 : _a.filter(relation => relation.rel === 'System.LinkTypes.Hierarchy-Forward')) === null || _b === void 0 ? void 0 : _b.map(relation => { var _a; return parseInt(((_a = relation.url) === null || _a === void 0 ? void 0 : _a.split('/').pop()) || ''); })) || [];
            return yield workItemTrackingApi.getWorkItems(childIds);
        });
        const fetchTasksByParentId = (parentId) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            const wiql = {
                query: `SELECT [System.Id] 
                    FROM WorkItems 
                    WHERE [System.WorkItemType] = 'Task' 
                    AND [System.Parent] = ${parentId}
                    ORDER BY [System.Id]`
            };
            const queryResult = yield workItemTrackingApi.queryByWiql(wiql);
            const taskIds = ((_c = queryResult.workItems) === null || _c === void 0 ? void 0 : _c.map(wi => wi.id)) || [];
            return taskIds.length ? yield workItemTrackingApi.getWorkItems(taskIds) : [];
        });
        const processWorkItem = (item) => __awaiter(this, void 0, void 0, function* () {
            var _d, _e;
            if (isClosed(item)) {
                return '';
            }
            const itemType = getWorkItemType(item);
            const formattedItem = formatWorkItem(item);
            if (itemType === 'Feature') {
                const children = yield fetchChildren(item);
                const childEntries = yield Promise.all((_d = children === null || children === void 0 ? void 0 : children.map(processWorkItem)) !== null && _d !== void 0 ? _d : []);
                return `project ${formattedItem}\n${childEntries.join('\n')}`;
            }
            else if (itemType === 'User Story') {
                const children = yield fetchTasksByParentId(item.id);
                const childEntries = yield Promise.all((_e = children === null || children === void 0 ? void 0 : children.map(processWorkItem)) !== null && _e !== void 0 ? _e : []);
                return `group ${formattedItem}\n${childEntries.join('\n')}\nendGroup\n`;
            }
            else if (itemType === 'Task') {
                return formattedItem;
            }
            else {
                return '';
            }
        });
        return yield processWorkItem(workItem);
    });
}
fetchWorkItems(workItemId);
