#!/usr/bin/env node

/**
 * Large Document Performance Test using textmarkdown.md
 */

require('dotenv').config();
const fs = require('fs');

async function testLargeMarkdownFile() {
    console.log('🎯 Large Document Performance Test - textmarkdown.md\n');
    
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PAGE_ID) {
        console.error('❌ Missing NOTION_TOKEN or NOTION_PAGE_ID in .env file');
        return;
    }
    
    // Read the markdown file
    let testMarkdown;
    try {
        testMarkdown = fs.readFileSync('/Users/lixiang/code/mytools/n8n/textmarkdown.md', 'utf8');
    } catch (error) {
        console.error('❌ Failed to read textmarkdown.md:', error.message);
        return;
    }
    
    console.log('📋 Document Analysis:');
    console.log(`   - Characters: ${testMarkdown.length.toLocaleString()}`);
    console.log(`   - Lines: ${testMarkdown.split('\n').length.toLocaleString()}`);
    console.log(`   - Headings: ${(testMarkdown.match(/^#+\s/gm) || []).length}`);
    console.log(`   - Code blocks: ${(testMarkdown.match(/```/g) || []).length / 2}`);
    console.log(`   - Tables: ${(testMarkdown.match(/^\|.*\|$/gm) || []).length}`);
    console.log(`   - Blockquotes: ${(testMarkdown.match(/^>/gm) || []).length}`);
    console.log(`   - Math formulas: ${(testMarkdown.match(/\$[^$]+\$/g) || []).length}`);
    console.log(`   - Citations: ${(testMarkdown.match(/\[cite:\s*\d+[^\]]*\]/g) || []).length}\n`);
    
    // Performance monitoring
    let apiCallCount = 0;
    let totalApiTime = 0;
    let apiCallSizes = [];
    let apiCallTimes = [];
    let errors = [];
    let largestCall = 0;
    let smallestCall = Infinity;
    
    const mockExecuteFunctions = {
        getNode: () => ({ name: 'Large Document Test Node' }),
        helpers: {
            httpRequestWithAuthentication: {
                call: async (context, authType, options) => {
                    const fetch = (await import('node-fetch')).default;
                    
                    apiCallCount++;
                    const blockCount = options.body.children.length;
                    apiCallSizes.push(blockCount);
                    largestCall = Math.max(largestCall, blockCount);
                    smallestCall = Math.min(smallestCall, blockCount);
                    
                    const startTime = Date.now();
                    
                    try {
                        const response = await fetch(options.url, {
                            method: options.method,
                            headers: {
                                'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
                                'Notion-Version': '2022-06-28',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(options.body)
                        });
                        
                        const endTime = Date.now();
                        const callTime = endTime - startTime;
                        totalApiTime += callTime;
                        apiCallTimes.push(callTime);
                        
                        // Show progress every 10 calls
                        if (apiCallCount % 10 === 0 || blockCount > 5) {
                            console.log(`   📡 API Call ${apiCallCount}: ${callTime}ms (${blockCount} blocks)`);
                        } else {
                            process.stdout.write('.');
                        }
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            const error = `${response.status} - ${errorText}`;
                            errors.push(error);
                            throw new Error(`API error: ${error}`);
                        }
                        
                        return await response.json();
                        
                    } catch (error) {
                        const endTime = Date.now();
                        const callTime = endTime - startTime;
                        apiCallTimes.push(callTime);
                        errors.push(error.message);
                        console.log(`\n   ❌ API Call ${apiCallCount} failed: ${error.message}`);
                        throw error;
                    }
                }
            }
        }
    };
    
    try {
        const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
        
        console.log('⏱️  Starting large document test...\n');
        const overallStartTime = Date.now();
        
        const result = await MarkdownToNotion.processToggleHeadingsWithAPI(
            mockExecuteFunctions,
            process.env.NOTION_PAGE_ID,
            testMarkdown,
            {
                preserveMath: true,
                mathDelimiter: '$',
                supportLatex: true,
                toggleHeadings: true
            },
            0
        );
        
        const overallEndTime = Date.now();
        const totalTime = overallEndTime - overallStartTime;
        
        // Calculate detailed statistics
        const avgApiTime = apiCallTimes.length > 0 ? totalApiTime / apiCallTimes.length : 0;
        const medianApiTime = apiCallTimes.length > 0 ? apiCallTimes.sort((a, b) => a - b)[Math.floor(apiCallTimes.length / 2)] : 0;
        const avgBlocksPerCall = apiCallSizes.length > 0 ? apiCallSizes.reduce((a, b) => a + b, 0) / apiCallSizes.length : 0;
        const successRate = ((apiCallCount - errors.length) / apiCallCount * 100);
        const blocksPerSecond = result.json.blocksAdded / (totalTime / 1000);
        const apiCallsPerMinute = apiCallCount / (totalTime / 60000);
        
        console.log('\n\n🎉 Large Document Test Results:');
        console.log('=' .repeat(60));
        
        // Basic Results
        console.log('📊 Basic Metrics:');
        console.log(`   ✅ Success: ${result.json.success}`);
        console.log(`   📦 Total blocks created: ${result.json.blocksAdded.toLocaleString()}`);
        console.log(`   🔄 API calls made: ${apiCallCount.toLocaleString()}`);
        console.log(`   ⏱️  Total time: ${totalTime.toLocaleString()}ms (${(totalTime/1000).toFixed(1)}s)`);
        console.log(`   💾 Document size: ${(testMarkdown.length / 1024).toFixed(1)} KB`);
        
        // Performance Analysis
        console.log('\n⚡ Performance Analysis:');
        console.log(`   🎯 Blocks per second: ${blocksPerSecond.toFixed(1)}`);
        console.log(`   📈 API calls per minute: ${apiCallsPerMinute.toFixed(1)}`);
        console.log(`   ⏱️  Average API time: ${avgApiTime.toFixed(0)}ms`);
        console.log(`   ⏱️  Median API time: ${medianApiTime.toFixed(0)}ms`);
        console.log(`   📦 Average blocks per call: ${avgBlocksPerCall.toFixed(1)}`);
        console.log(`   📦 Largest batch: ${largestCall} blocks`);
        console.log(`   📦 Smallest batch: ${smallestCall} blocks`);
        console.log(`   ✅ Success rate: ${successRate.toFixed(1)}%`);
        
        // Efficiency Analysis
        console.log('\n📈 Efficiency Analysis:');
        
        // Time efficiency
        const timePerKB = totalTime / (testMarkdown.length / 1024);
        console.log(`   ⏱️  Time per KB: ${timePerKB.toFixed(0)}ms/KB`);
        
        if (totalTime < 30000) {
            console.log('   🟢 Overall Speed: Excellent (< 30s)');
        } else if (totalTime < 60000) {
            console.log('   🟡 Overall Speed: Good (30-60s)');
        } else if (totalTime < 120000) {
            console.log('   🟠 Overall Speed: Acceptable (1-2 min)');
        } else {
            console.log('   🔴 Overall Speed: Slow (> 2 min)');
        }
        
        // Batching efficiency
        if (avgBlocksPerCall > 50) {
            console.log('   🟢 Batching: Excellent (>50 blocks/call)');
        } else if (avgBlocksPerCall > 20) {
            console.log('   🟡 Batching: Good (20-50 blocks/call)');
        } else if (avgBlocksPerCall > 10) {
            console.log('   🟠 Batching: Moderate (10-20 blocks/call)');
        } else {
            console.log('   🔴 Batching: Poor (<10 blocks/call)');
        }
        
        // API efficiency
        if (blocksPerSecond > 5) {
            console.log('   🟢 Throughput: Excellent (>5 blocks/s)');
        } else if (blocksPerSecond > 2) {
            console.log('   🟡 Throughput: Good (2-5 blocks/s)');
        } else if (blocksPerSecond > 1) {
            console.log('   🟠 Throughput: Moderate (1-2 blocks/s)');
        } else {
            console.log('   🔴 Throughput: Poor (<1 block/s)');
        }
        
        // Scalability Analysis
        console.log('\n📏 Scalability Analysis:');
        const estimatedTimeFor1MB = (timePerKB * 1024) / 1000;
        console.log(`   📊 Estimated time for 1MB document: ${estimatedTimeFor1MB.toFixed(1)}s`);
        
        if (estimatedTimeFor1MB < 300) {
            console.log('   🟢 Scalability: Good for large documents');
        } else if (estimatedTimeFor1MB < 600) {
            console.log('   🟡 Scalability: Acceptable for medium documents');
        } else {
            console.log('   🔴 Scalability: Limited to small documents');
        }
        
        // Detailed Statistics
        console.log('\n📊 Detailed Statistics:');
        console.log(`   📡 API time range: ${Math.min(...apiCallTimes)}ms - ${Math.max(...apiCallTimes)}ms`);
        console.log(`   📦 Block size range: ${smallestCall} - ${largestCall} blocks`);
        console.log(`   🔄 API overhead: ${(totalApiTime / totalTime * 100).toFixed(1)}% of total time`);
        
        // Content Analysis
        console.log('\n📝 Content Processing:');
        const headingCount = (testMarkdown.match(/^#+\s/gm) || []).length;
        const avgBlocksPerHeading = result.json.blocksAdded / headingCount;
        console.log(`   📑 Headings processed: ${headingCount}`);
        console.log(`   📦 Average blocks per heading: ${avgBlocksPerHeading.toFixed(1)}`);
        console.log(`   🔄 API calls per heading: ${(apiCallCount / headingCount).toFixed(1)}`);
        
        if (errors.length > 0) {
            console.log(`\n❌ Errors (${errors.length}):`);
            errors.slice(0, 5).forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
            if (errors.length > 5) {
                console.log(`   ... and ${errors.length - 5} more errors`);
            }
        }
        
        if (result.json.warnings?.length > 0) {
            console.log(`\n⚠️  Warnings (${result.json.warnings.length}):`);
            result.json.warnings.slice(0, 3).forEach((warning, i) => {
                console.log(`   ${i + 1}. ${warning}`);
            });
            if (result.json.warnings.length > 3) {
                console.log(`   ... and ${result.json.warnings.length - 3} more warnings`);
            }
        }
        
        console.log(`\n🔗 View result: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
        
        // Performance Recommendations
        console.log('\n💡 Performance Recommendations:');
        if (avgBlocksPerCall < 20) {
            console.log('   • Optimize batching: Too many small API calls detected');
        }
        if (totalTime > 60000) {
            console.log('   • Consider document size limits or progress indicators');
        }
        if (blocksPerSecond < 2) {
            console.log('   • API throughput is low, investigate bottlenecks');
        }
        if (apiCallCount > result.json.blocksAdded / 10) {
            console.log('   • High API call overhead, review batching strategy');
        }
        if (successRate === 100 && avgBlocksPerCall > 20 && totalTime < 60000) {
            console.log('   🎉 Performance is good for this document size!');
        }
        
        // Final Assessment
        console.log('\n🎯 Final Assessment:');
        let score = 0;
        if (successRate === 100) score += 25;
        if (totalTime < 60000) score += 25;
        if (avgBlocksPerCall > 20) score += 25;
        if (blocksPerSecond > 2) score += 25;
        
        if (score >= 90) {
            console.log('   🟢 Overall Grade: A (Excellent performance)');
        } else if (score >= 70) {
            console.log('   🟡 Overall Grade: B (Good performance)');
        } else if (score >= 50) {
            console.log('   🟠 Overall Grade: C (Acceptable performance)');
        } else {
            console.log('   🔴 Overall Grade: D (Needs optimization)');
        }
        
    } catch (error) {
        console.error('\n❌ Large document test failed:', error.message);
        
        if (error.message.includes('401')) {
            console.error('   🔑 Check your NOTION_TOKEN');
        } else if (error.message.includes('404')) {
            console.error('   📄 Check your NOTION_PAGE_ID');
        } else if (error.message.includes('429')) {
            console.error('   🚦 Rate limited - document too large or too fast');
        }
        
        console.log('\n📊 Partial Statistics:');
        console.log(`   📡 API calls completed: ${apiCallCount}`);
        console.log(`   ❌ Errors encountered: ${errors.length}`);
        if (apiCallTimes.length > 0) {
            console.log(`   ⏱️  Average API time: ${(totalApiTime / apiCallTimes.length).toFixed(0)}ms`);
            console.log(`   📦 Average blocks per call: ${(apiCallSizes.reduce((a, b) => a + b, 0) / apiCallSizes.length).toFixed(1)}`);
        }
    }
}

testLargeMarkdownFile();