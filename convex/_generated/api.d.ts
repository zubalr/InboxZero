/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailAccountMutations from "../emailAccountMutations.js";
import type * as emailBatch from "../emailBatch.js";
import type * as emailFeedback from "../emailFeedback.js";
import type * as emailIngestion from "../emailIngestion.js";
import type * as emailParsing from "../emailParsing.js";
import type * as emailProviders from "../emailProviders.js";
import type * as emailProviders_new from "../emailProviders_new.js";
import type * as emailSync from "../emailSync.js";
import type * as email_new from "../email_new.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as integrations_actions from "../integrations_actions.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_cache from "../lib/cache.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_logging from "../lib/logging.js";
import type * as messages from "../messages.js";
import type * as messages_new from "../messages_new.js";
import type * as performance from "../performance.js";
import type * as presence from "../presence.js";
import type * as resend from "../resend.js";
import type * as search from "../search.js";
import type * as tasks from "../tasks.js";
import type * as teams from "../teams.js";
import type * as test_email from "../test_email.js";
import type * as test_email_parsing from "../test_email_parsing.js";
import type * as test_email_storage from "../test_email_storage.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  auth: typeof auth;
  comments: typeof comments;
  crons: typeof crons;
  email: typeof email;
  emailAccountMutations: typeof emailAccountMutations;
  emailBatch: typeof emailBatch;
  emailFeedback: typeof emailFeedback;
  emailIngestion: typeof emailIngestion;
  emailParsing: typeof emailParsing;
  emailProviders: typeof emailProviders;
  emailProviders_new: typeof emailProviders_new;
  emailSync: typeof emailSync;
  email_new: typeof email_new;
  http: typeof http;
  integrations: typeof integrations;
  integrations_actions: typeof integrations_actions;
  "lib/ai": typeof lib_ai;
  "lib/cache": typeof lib_cache;
  "lib/errors": typeof lib_errors;
  "lib/logging": typeof lib_logging;
  messages: typeof messages;
  messages_new: typeof messages_new;
  performance: typeof performance;
  presence: typeof presence;
  resend: typeof resend;
  search: typeof search;
  tasks: typeof tasks;
  teams: typeof teams;
  test_email: typeof test_email;
  test_email_parsing: typeof test_email_parsing;
  test_email_storage: typeof test_email_storage;
  threads: typeof threads;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
