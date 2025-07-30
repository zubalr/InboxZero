#!/usr/bin/env bun

/**
 * Comprehensive test runner for InboxZero AI
 * Runs all test suites with proper reporting and error handling
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  command: string[];
  description: string;
  timeout?: number;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - Convex Functions',
    command: ['bun', 'test', 'test/convex/', '--reporter=verbose'],
    description: 'Testing all Convex queries, mutations, and actions',
    timeout: 30000,
  },
  {
    name: 'Unit Tests - React Components',
    command: ['bun', 'test', 'test/components/', '--reporter=verbose'],
    description: 'Testing React components with mocked dependencies',
    timeout: 20000,
  },
  {
    name: 'Integration Tests',
    command: ['bun', 'test', 'test/integration/', '--reporter=verbose'],
    description: 'Testing complete workflows and service integrations',
    timeout: 60000,
  },
  {
    name: 'Performance Tests',
    command: ['bun', 'test', 'test/performance/', '--reporter=verbose'],
    description: 'Load testing and performance benchmarks',
    timeout: 120000,
  },
  {
    name: 'Coverage Report',
    command: ['bun', 'test', '--coverage', '--reporter=verbose'],
    description: 'Generating comprehensive test coverage report',
    timeout: 90000,
  },
];

interface TestResult {
  suite: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting InboxZero AI Test Suite');
    console.log('='.repeat(60));

    // Ensure coverage directory exists
    const coverageDir = join(process.cwd(), 'coverage');
    if (!existsSync(coverageDir)) {
      mkdirSync(coverageDir, { recursive: true });
    }

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }

    this.printSummary();
    this.exitWithCode();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 Running: ${suite.name}`);
    console.log(`   ${suite.description}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();

    try {
      const result = await this.executeCommand(suite.command, suite.timeout);
      const duration = Date.now() - startTime;

      this.results.push({
        suite: suite.name,
        success: result.success,
        duration,
        output: result.output,
        error: result.error,
      });

      if (result.success) {
        console.log(`✅ ${suite.name} completed successfully (${duration}ms)`);
      } else {
        console.log(`❌ ${suite.name} failed (${duration}ms)`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`💥 ${suite.name} crashed (${duration}ms)`);
      console.log(`   Error: ${error}`);

      this.results.push({
        suite: suite.name,
        success: false,
        duration,
        output: '',
        error: String(error),
      });
    }
  }

  private executeCommand(
    command: string[],
    timeout: number = 30000
  ): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const process = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
      });

      let output = '';
      let errorOutput = '';

      process.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());
      });

      process.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error(text.trim());
      });

      const timeoutId = setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          success: false,
          output,
          error: `Test suite timed out after ${timeout}ms`,
        });
      }, timeout);

      process.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? errorOutput : undefined,
        });
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output,
          error: error.message,
        });
      });
    });
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Successful Suites: ${successful}`);
    console.log(`Failed Suites: ${failed}`);
    console.log(`Total Suites: ${this.results.length}`);

    if (failed > 0) {
      console.log('\n❌ FAILED SUITES:');
      this.results
        .filter((r) => !r.success)
        .forEach((result) => {
          console.log(`   • ${result.suite} (${result.duration}ms)`);
          if (result.error) {
            console.log(`     ${result.error}`);
          }
        });
    }

    if (successful > 0) {
      console.log('\n✅ SUCCESSFUL SUITES:');
      this.results
        .filter((r) => r.success)
        .forEach((result) => {
          console.log(`   • ${result.suite} (${result.duration}ms)`);
        });
    }

    console.log('\n' + '='.repeat(60));
  }

  private exitWithCode(): void {
    const hasFailures = this.results.some((r) => !r.success);

    if (hasFailures) {
      console.log('❌ Some tests failed. Exiting with code 1.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! Exiting with code 0.');
      process.exit(0);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  const runner = new TestRunner();
  runner.runAllTests().catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });
}
