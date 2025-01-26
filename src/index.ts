#!/usr/bin/env ts-node

import * as azdev from 'azure-devops-node-api';
import * as witApi from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import * as msRestNodeAuth from '@azure/ms-rest-nodeauth';
import * as fs from 'fs';
import * as path from 'path';
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';

const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: azure-markwhen <organization> <work-item-id>");
    process.exit(1);
}

const organization = args[0];
const workItemId = args[1];
const tokenFilePath = path.join(__dirname, '.token');

async function fetchWorkItems(organization: string, workItemId: string) {
    try {
        const orgUrl = `https://dev.azure.com/${organization}`;

        let token = await getToken();
        let authHandler = azdev.getBearerHandler(token);
        let connection = new azdev.WebApi(orgUrl, authHandler);
        let workItemTrackingApi;
        try {
            workItemTrackingApi = await connection.getWorkItemTrackingApi();
            const workItem = await workItemTrackingApi.getWorkItem(parseInt(workItemId), undefined, undefined, witApi.WorkItemExpand.Relations);
            const markWhenEntries = await transformToMarkWhen(workItemTrackingApi, workItem);
            console.log(markWhenEntries);
        } catch (error) {
            if (error !== null && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.includes("is not authorized to access this resource")) {
                console.error("Authentication error, re-authenticating...");
                token = await reAuthenticate();
                authHandler = azdev.getBearerHandler(token);
                connection = new azdev.WebApi(orgUrl, authHandler);
                workItemTrackingApi = await connection.getWorkItemTrackingApi();
                const workItem = await workItemTrackingApi.getWorkItem(parseInt(workItemId), undefined, undefined, witApi.WorkItemExpand.Relations);
                const markWhenEntries = await transformToMarkWhen(workItemTrackingApi, workItem);
                console.log(markWhenEntries);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Error fetching work items:", typeof error === "object" && error !== null && "message" in error ? error.message : error);
        if (error instanceof Error) {
            console.error(error.stack);
        }
    }
}

async function getToken(): Promise<string> {
    if (fs.existsSync(tokenFilePath)) {
        return fs.readFileSync(tokenFilePath, 'utf8');
    } else {
        return await reAuthenticate();
    }
}

async function reAuthenticate(): Promise<string> {
    const credentials = await msRestNodeAuth.interactiveLogin();
    const token = (await credentials.getToken()).accessToken;
    fs.writeFileSync(tokenFilePath, token, 'utf8');
    return token;
}

async function transformToMarkWhen(workItemTrackingApi: IWorkItemTrackingApi, workItem: witApi.WorkItem): Promise<string> {
    const today = new Date();
    const twoDaysFromToday = new Date(today);
    twoDaysFromToday.setDate(today.getDate() + 2);

    const formatWorkItem = (item: witApi.WorkItem): string => {
        const title = item.fields?.['System.Title'] || 'No Title';
        const assignedTo = item.fields?.['System.AssignedTo']?.displayName || 'Unassigned';
        if (getWorkItemType(item) !== "Task") {
            return `${title} #${removeSpace(assignedTo)}`;
        }
        return `0 days: ${title} #${removeSpace(assignedTo)}`;
    };

    const removeSpace = (item: string): string => {
        return item.replace(" ", "_");
    };

    const getWorkItemType = (item: witApi.WorkItem): string => {
        return item.fields?.['System.WorkItemType'] || 'Unknown';
    };

    const isClosed = (item: witApi.WorkItem): boolean => {
        const state = item.fields?.['System.State'] || 'Unknown';
        return state.toLowerCase() === 'closed';
    };

    const fetchChildren = async (item: witApi.WorkItem): Promise<witApi.WorkItem[]> => {
        const childIds = item.relations
            ?.filter(relation => relation.rel === 'System.LinkTypes.Hierarchy-Forward')
            ?.map(relation => parseInt(relation.url?.split('/').pop() || '')) || [];
        return await workItemTrackingApi.getWorkItems(childIds);
    };

    const fetchTasksByParentId = async (parentId: number): Promise<witApi.WorkItem[]> => {
        const wiql = {
            query: `SELECT [System.Id] 
                    FROM WorkItems 
                    WHERE [System.WorkItemType] = 'Task' 
                    AND [System.Parent] = ${parentId}
                    ORDER BY [System.Id]`
        };

        const queryResult = await workItemTrackingApi.queryByWiql(wiql);
        const taskIds = queryResult.workItems?.map(wi => wi.id) || [];
        return taskIds.length ? await workItemTrackingApi.getWorkItems(taskIds as number[]) : [];
    };

    const processWorkItem = async (item: witApi.WorkItem): Promise<string> => {
        if (isClosed(item)) {
            return '';
        }

        const itemType = getWorkItemType(item);
        const formattedItem = formatWorkItem(item);

        if (itemType === 'Feature') {
            const children = await fetchChildren(item);
            const childEntries = await Promise.all(children?.map(processWorkItem) ?? []);
            const result = childEntries.filter(entry => entry).join('\n');
            return result ? `project ${formattedItem}\n${result}` : '';
        } else if (itemType === 'User Story') {
            const children = await fetchTasksByParentId(item.id!);
            const childEntries = await Promise.all(children?.map(processWorkItem) ?? []);
            const result = childEntries.filter(entry => entry).join('\n');
            return result ? `group ${formattedItem}\n${result}\nendGroup\n` : '';
        } else if (itemType === 'Task') {
            return formattedItem;
        } else {
            return '';
        }
    };

    return await processWorkItem(workItem);
}

fetchWorkItems(organization, workItemId);
