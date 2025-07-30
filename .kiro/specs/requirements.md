# Requirements Document

## Introduction

InboxZero AI is a productivity-focused SaaS email platform that transforms shared inboxes from chaotic repositories into intelligent, actionable workspaces. The platform combines high-speed AI assistance (summarization, smart replies, prioritization) with seamlessly synchronized team collaboration, all built on a modern, serverless, real-time Convex backend with the Convex Resend Component for email handling.

The target audience is small to medium-sized teams in customer support, sales, or project management who rely on shared email addresses and are encumbered by the inefficiencies of traditional email clients.

## Requirements

### Requirement 1

**User Story:** As a team member, I want to receive and view incoming emails in a shared inbox interface, so that I can see all team communications in one centralized location.

#### Acceptance Criteria

1. WHEN an email is sent to our team's shared address THEN the system SHALL automatically ingest it via Resend webhook and store it in the Convex database
2. WHEN I access the inbox interface THEN the system SHALL display a list of all email threads with sender, subject, and timestamp
3. WHEN I click on a thread THEN the system SHALL show all messages in that conversation in chronological order
4. IF an email is a reply to an existing thread THEN the system SHALL associate it with the correct thread using email headers

### Requirement 2

**User Story:** As a team member, I want AI-powered email summarization, so that I can quickly understand long email threads without reading every message.

#### Acceptance Criteria

1. WHEN I view an email thread THEN the system SHALL automatically generate a concise summary using Groq/Cerebras API
2. WHEN a summary is generated THEN the system SHALL cache it in the database to avoid redundant API calls
3. WHEN new messages are added to a thread THEN the system SHALL provide an option to regenerate the summary
4. WHEN I click "Save to Notion" THEN the system SHALL create a new Notion page with the summary and thread link

### Requirement 3

**User Story:** As a team member, I want AI-generated smart reply suggestions, so that I can respond to emails more efficiently with contextually appropriate responses.

#### Acceptance Criteria

1. WHEN I click "Reply with AI" THEN the system SHALL present tone options (Formal, Friendly, Short, Detailed)
2. WHEN I select a tone THEN the system SHALL generate a contextually relevant draft using Groq API
3. WHEN the draft is generated THEN the system SHALL populate the reply editor with the suggested text
4. WHEN I send the reply THEN the system SHALL use the Convex Resend Component to deliver the email

### Requirement 4

**User Story:** As a team member, I want to add internal comments to email threads, so that I can collaborate with teammates without sending external emails.

#### Acceptance Criteria

1. WHEN I view an email thread THEN the system SHALL display a visually distinct internal comments section
2. WHEN I post an internal comment THEN the system SHALL save it with my user ID and timestamp
3. WHEN another team member views the same thread THEN they SHALL see my comment in real-time without page refresh
4. WHEN I mention a teammate using @handle THEN the system SHALL highlight the mention appropriately

### Requirement 5

**User Story:** As a team member, I want to assign email threads to specific teammates, so that we can clearly distribute responsibility for responses.

#### Acceptance Criteria

1. WHEN I view an email thread THEN the system SHALL display the current assignee or "Unassigned" status
2. WHEN I select a new assignee from the dropdown THEN the system SHALL update the assignment immediately
3. WHEN an assignment changes THEN all team members viewing the thread SHALL see the update in real-time
4. WHEN viewing the inbox list THEN the system SHALL show assignment status for each thread

### Requirement 6

**User Story:** As a team member, I want automatic email priority tagging, so that I can focus on the most important messages first.

#### Acceptance Criteria

1. WHEN an email is ingested THEN the system SHALL automatically classify it as "Urgent", "Action Required", or "Info-Only" using AI
2. WHEN I view the inbox THEN the system SHALL display priority tags with visual indicators
3. WHEN I provide feedback on a priority tag THEN the system SHALL record it for future model improvement
4. WHEN viewing a thread THEN the system SHALL show the priority level prominently

### Requirement 7

**User Story:** As a team member, I want to create tasks from emails in external systems, so that I can track follow-up actions in my preferred task management tool.

#### Acceptance Criteria

1. WHEN I click "Create Task" on an email thread THEN the system SHALL present integration options (Notion, Asana, ClickUp)
2. WHEN I select an integration and provide task details THEN the system SHALL create the task in the external system
3. WHEN a task is created THEN the system SHALL populate it with the email subject and a link back to the thread
4. WHEN task creation completes THEN the system SHALL show confirmation to the user

### Requirement 8

**User Story:** As a team member, I want to search through email threads and messages, so that I can quickly find specific conversations or information.

#### Acceptance Criteria

1. WHEN I type in the search bar THEN the system SHALL use Convex's full-text search to find matching threads
2. WHEN search results are returned THEN the system SHALL highlight matches in subject lines and message content
3. WHEN I use filters (priority, assignee, status) THEN the system SHALL combine them with text search effectively
4. WHEN I clear the search THEN the system SHALL return to the default inbox view

### Requirement 9

**User Story:** As a team member, I want to see real-time presence indicators, so that I know when teammates are viewing the same email thread.

#### Acceptance Criteria

1. WHEN I view an email thread THEN the system SHALL show which other team members are currently viewing it
2. WHEN another user opens the same thread THEN I SHALL see their presence indicator appear immediately
3. WHEN a user leaves a thread THEN their presence indicator SHALL disappear after a reasonable timeout
4. WHEN multiple users are present THEN the system SHALL display all active viewers clearly

### Requirement 10

**User Story:** As a team member, I want to react to internal comments with emojis, so that I can provide quick feedback without writing full responses.

#### Acceptance Criteria

1. WHEN I view an internal comment THEN the system SHALL provide an option to add emoji reactions
2. WHEN I select an emoji THEN the system SHALL add my reaction and display it immediately
3. WHEN other users view the comment THEN they SHALL see all reactions with counts in real-time
4. WHEN I click an emoji I've already used THEN the system SHALL remove my reaction
