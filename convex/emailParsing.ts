/**
 * Email parsing utilities for InboxZero AI
 * This module contains functions for parsing email headers, content, and threading information
 */

export interface ParsedEmailAddress {
  email: string;
  name?: string;
}

export interface ParsedEmail {
  messageId: string;
  inReplyTo?: string;
  references: string[];
  from: ParsedEmailAddress;
  to: ParsedEmailAddress[];
  cc?: ParsedEmailAddress[];
  bcc?: ParsedEmailAddress[];
  subject: string;
  textContent?: string;
  htmlContent?: string;
  date: string;
  headers: Record<string, string>;
}

/**
 * Parse email address string into structured format with robust error handling
 * Handles various formats:
 * - "John Doe <john@example.com>"
 * - "john@example.com"
 * - "<john@example.com>"
 * - "\"John Doe\" <john@example.com>"
 */
export function parseEmailAddress(emailString: string): ParsedEmailAddress {
  if (!emailString || typeof emailString !== 'string') {
    throw new Error('Invalid email string provided');
  }

  const trimmed = emailString.trim();

  if (!trimmed) {
    throw new Error('Empty email string provided');
  }

  // Pattern to match: "Name" <email@domain.com> or Name <email@domain.com>
  const namedEmailPattern = /^(?:"?([^"<>]+?)"?\s*)?<([^<>]+)>$/;
  const match = trimmed.match(namedEmailPattern);

  if (match) {
    const [, name, email] = match;
    const cleanEmail = email.trim();

    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      throw new Error(`Invalid email format: ${cleanEmail}`);
    }

    return {
      email: cleanEmail,
      name: name ? name.trim() : undefined,
    };
  }

  // Check if it's just an email address
  if (isValidEmail(trimmed)) {
    return { email: trimmed };
  }

  // If no angle brackets, try to extract email from the string
  const emailMatch = trimmed.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
  if (emailMatch) {
    const email = emailMatch[1];
    if (isValidEmail(email)) {
      const name = trimmed.replace(email, '').replace(/[<>]/g, '').trim();
      return {
        email,
        name: name || undefined,
      };
    }
  }

  throw new Error(`Unable to parse email address: ${emailString}`);
}

/**
 * Enhanced email validation
 */
function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 254; // RFC 5321 limit
}

/**
 * Parse multiple email addresses from a string or array
 */
export function parseEmailAddresses(
  input: string | string[]
): ParsedEmailAddress[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input.map(parseEmailAddress);
  }

  // Split by comma and parse each address
  const addresses = input
    .split(',')
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0);
  return addresses.map(parseEmailAddress);
}

/**
 * Parse email references header for threading
 * References can be space-separated or comma-separated message IDs
 */
export function parseReferences(
  references: string | string[] | undefined
): string[] {
  if (!references) return [];

  if (Array.isArray(references)) {
    return references.filter((ref) => ref && ref.trim().length > 0);
  }

  if (typeof references !== 'string') return [];

  // Split by whitespace or commas, filter out empty strings
  return references
    .split(/[\s,]+/)
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0 && ref.includes('@')); // Basic validation for message IDs
}

/**
 * Extract Message-ID from email headers
 * Message-IDs should be in format: <unique-id@domain.com>
 */
export function parseMessageId(messageId: string | undefined): string {
  if (!messageId) {
    // Generate a fallback message ID
    return `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@inboxzero.ai>`;
  }

  const trimmed = messageId.trim();

  // Ensure message ID is wrapped in angle brackets
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return `<${trimmed}>`;
  }

  return trimmed;
}

/**
 * Parse In-Reply-To header
 */
export function parseInReplyTo(
  inReplyTo: string | undefined
): string | undefined {
  if (!inReplyTo) return undefined;

  const trimmed = inReplyTo.trim();

  // Ensure it's wrapped in angle brackets
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    return `<${trimmed}>`;
  }

  return trimmed;
}

/**
 * Clean and normalize email subject
 */
export function parseSubject(subject: string | undefined): string {
  if (!subject) return '(No Subject)';

  return subject.trim() || '(No Subject)';
}

/**
 * Parse email date header
 */
export function parseDate(date: string | undefined): string {
  if (!date) return new Date().toISOString();

  try {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return new Date().toISOString();
    }
    return parsedDate.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Extract plain text content from HTML
 * This is a simple implementation - in production you might want to use a proper HTML parser
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';

  // Remove HTML tags and decode common entities
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Determine if an email is likely an auto-reply or out-of-office message
 */
export function isAutoReply(
  subject: string,
  headers: Record<string, string>
): boolean {
  const subjectLower = subject.toLowerCase();

  // Check for common auto-reply indicators in subject
  const autoReplyPatterns = [
    'auto-reply',
    'automatic reply',
    'out of office',
    'out-of-office',
    'vacation',
    'away',
    'not available',
    'delivery status notification',
    'undelivered mail',
    'mail delivery failed',
  ];

  if (autoReplyPatterns.some((pattern) => subjectLower.includes(pattern))) {
    return true;
  }

  // Check headers for auto-reply indicators
  const autoSubmitted = headers['auto-submitted'] || headers['Auto-Submitted'];
  if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') {
    return true;
  }

  const precedence = headers['precedence'] || headers['Precedence'];
  if (
    precedence &&
    ['auto_reply', 'auto-reply'].includes(precedence.toLowerCase())
  ) {
    return true;
  }

  return false;
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Build thread association key for grouping related emails
 * This helps with threading when standard headers are missing
 */
export function buildThreadKey(
  subject: string,
  participants: ParsedEmailAddress[]
): string {
  // Normalize subject by removing common prefixes
  const normalizedSubject = subject
    .replace(/^(re:|fwd?:|fw:)\s*/i, '')
    .trim()
    .toLowerCase();

  // Sort participant emails for consistent key generation
  const sortedEmails = participants
    .map((p) => p.email.toLowerCase())
    .sort()
    .join(',');

  return `${normalizedSubject}|${sortedEmails}`;
}

/**
 * Parse complete email from webhook data with comprehensive error handling
 */
export function parseEmailFromWebhook(webhookData: any): ParsedEmail {
  try {
    const {
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      message_id: messageId,
      in_reply_to: inReplyTo,
      references,
      date,
      headers = {},
    } = webhookData;

    // Validate required fields
    if (!from) {
      throw new Error('Missing required field: from');
    }
    if (!to) {
      throw new Error('Missing required field: to');
    }
    if (!subject && !text && !html) {
      throw new Error('Email must have at least a subject or content');
    }

    // Parse with error handling for each field
    let parsedFrom: ParsedEmailAddress;
    try {
      parsedFrom = parseEmailAddress(from);
    } catch (error) {
      throw new Error(
        `Failed to parse 'from' address: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    let parsedTo: ParsedEmailAddress[];
    try {
      parsedTo = parseEmailAddresses(to);
      if (parsedTo.length === 0) {
        throw new Error('No valid recipients found in "to" field');
      }
    } catch (error) {
      throw new Error(
        `Failed to parse 'to' addresses: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Parse optional fields with error handling
    let parsedCc: ParsedEmailAddress[] | undefined;
    if (cc) {
      try {
        parsedCc = parseEmailAddresses(cc);
      } catch (error) {
        console.warn('Failed to parse CC addresses:', error);
        parsedCc = undefined;
      }
    }

    let parsedBcc: ParsedEmailAddress[] | undefined;
    if (bcc) {
      try {
        parsedBcc = parseEmailAddresses(bcc);
      } catch (error) {
        console.warn('Failed to parse BCC addresses:', error);
        parsedBcc = undefined;
      }
    }

    return {
      messageId: parseMessageId(messageId),
      inReplyTo: parseInReplyTo(inReplyTo),
      references: parseReferences(references),
      from: parsedFrom,
      to: parsedTo,
      cc: parsedCc,
      bcc: parsedBcc,
      subject: parseSubject(subject),
      textContent: text,
      htmlContent: html,
      date: parseDate(date),
      headers: headers || {},
    };
  } catch (error) {
    console.error('Error parsing email from webhook:', error);
    throw new Error(
      `Email parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
