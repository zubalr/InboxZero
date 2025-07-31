'use node';

import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { Client } from '@notionhq/client';

// Action to create a task in Notion - Node.js runtime for external API calls
export const createTaskInNotion = internalAction({
  args: {
    taskId: v.id('tasks'),
    title: v.string(),
    description: v.optional(v.string()),
    threadUrl: v.string(),
    teamId: v.id('teams'),
    priority: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notionIntegration: any = await ctx.runQuery(
      api.integrations.getNotionIntegration,
      {
        teamId: args.teamId,
      }
    );

    if (
      !notionIntegration?.configuration.apiKey ||
      !notionIntegration?.configuration.databaseId
    ) {
      throw new Error('Notion API key or Database ID not configured');
    }

    const notion = new Client({
      auth: notionIntegration.configuration.apiKey,
    });

    try {
      const response = await notion.pages.create({
        parent: { database_id: notionIntegration.configuration.databaseId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: args.title,
                },
              },
            ],
          },
          Status: {
            select: {
              name: 'To-Do',
            },
          },
          Priority: {
            select: {
              name: args.priority,
            },
          },
          Link: {
            url: args.threadUrl,
          },
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: args.description || 'No description provided.',
                  },
                },
              ],
            },
          },
        ],
      });

      // Update the task with the Notion page ID and URL
      await ctx.runMutation(internal.integrations.updateTaskWithNotionDetails, {
        taskId: args.taskId,
        externalId: response.id,
        externalUrl: `https://notion.so/${response.id.replace(/-/g, '')}`,
      });

      return null;
    } catch (error: any) {
      console.error('Error creating Notion page:', error.body || error.message);
      throw new Error('Failed to create task in Notion');
    }
  },
});
