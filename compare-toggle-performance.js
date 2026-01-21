#!/usr/bin/env node

/**
 * Performance Comparison: Toggle ON vs Toggle OFF
 */

require('dotenv').config();
const fs = require('fs');

async function compareTogglePerformance() {
    console.log('🔄 Performance Comparison: Toggle Headings ON vs OFF\n');
    
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
    console.log(`   - Size: ${(testMarkdown.length / 1024).toFixed(1)} KB`);
    console.log(`   - Headings: ${(testMarkdown.match(/^#+\s/gm) || []).length}`);
    console.log(`   - Lines: ${testMarkdown.split('\n').length.toLocaleString()}\n`);
    
    const results = {};
    
    // Test both modes
    for (const toggleMode of [false, true]) {
        const modeName = toggleMode ? 'Toggle ON' : 'Toggle OFF';
        console.log(`🧪 Testing ${modeName}...`);
        
        let apiCallCount = 0;
        let totalApiTime = 0;
        let apiCallSizes = [];
        let apiCallTimes = [];
        let errors = [];
        
        const mockExecuteFunctions = {
            getNode: () => ({ name: `${modeName} Test Node` }),
            helpers: {
                httpRequestWithAuthentication: {
                    call: async (context, authType, options) => {
                        const fetch = (await import('node-fetch')).default;
                        
                        apiCallCount++;
                        const blockCount = options.body.children.length;
                        apiCallSizes.push(blockCount);
                        
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
                            
                            // Show progress for large batches
                            if (blockCount > 10) {
                                console.log(`   📡 API Call ${apiCallCount}: ${callTime}ms (${blockCount} blocks)`);
                            } else if (apiCallCount % 20 === 0) {
                                console.log(`   📡 Progress: ${apiCallCount} calls completed`);
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
                            throw error;
                        }
                    }
                }
            }
        };
        
        try {
            const { MarkdownToNotion } = require('./dist/nodes/MarkdownToNotion/MarkdownToNotion.node.js');
            
            const overallStartTime = Date.now();
            
            let result;
            if (toggleMode) {
                // Use toggle headings mode
                result = await MarkdownToNotion.processToggleHeadingsWithAPI(
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
            } else {
                // Use regular mode (should use the original batching logic)
                // We need to simulate the regular execute method
                const blocks = await MarkdownToNotion.convertMarkdownToNotionBlocks(
                    testMarkdown,
                    true,  // preserveMath
                    '$',   // mathDelimiter
                    true,  // supportLatex
                    false  // toggleHeadings
                );
                
                // Simulate the original batching logic
                const MAX_BLOCKS_PER_REQUEST = 100;
                const allResponses = [];
                let totalBlocksAdded = 0;
                const warnings = [];
                
                for (let chunkIndex = 0; chunkIndex < blocks.length; chunkIndex += MAX_BLOCKS_PER_REQUEST) {
                    const chunk = blocks.slice(chunkIndex, chunkIndex + MAX_BLOCKS_PER_REQUEST);
                    
                    const response = await mockExecuteFunctions.helpers.httpRequestWithAuthentication.call(
                        mockExecuteFunctions,
                        'notionApi',
                        {
                            method: 'PATCH',
                            url: `https://api.notion.com/v1/blocks/${process.env.NOTION_PAGE_ID}/children`,
                            body: { children: chunk },
                            json: true,
                        }
                    );
                    
                    totalBlocksAdded += response.results?.length || 0;
                    allResponses.push(response);
                }
                
                result = {
                    json: {
                        success: true,
                        blocksAdded: totalBlocksAdded,
                        chunksProcessed: allResponses.length,
                        responses: allResponses,
                        warnings
                    }
                };
            }
            
            const overallEndTime = Date.now();
            const totalTime = overallEndTime - overallStartTime;
            
            // Calculate statistics
            const avgApiTime = apiCallTimes.length > 0 ? totalApiTime / apiCallTimes.length : 0;
            const avgBlocksPerCall = apiCallSizes.length > 0 ? apiCallSizes.reduce((a, b) => a + b, 0) / apiCallSizes.length : 0;
            const successRate = ((apiCallCount - errors.length) / apiCallCount * 100);
            const blocksPerSecond = result.json.blocksAdded / (totalTime / 1000);
            
            // Store results
            results[modeName] = {
                totalTime,
                apiCallCount,
                blocksAdded: result.json.blocksAdded,
                avgApiTime,
                avgBlocksPerCall,
                successRate,
                blocksPerSecond,
                maxBatch: Math.max(...apiCallSizes),
                minBatch: Math.min(...apiCallSizes),
                errors: errors.length,
                warnings: result.json.warnings?.length || 0
            };
            
            console.log(`   ✅ ${modeName} completed: ${totalTime}ms, ${result.json.blocksAdded} blocks, ${apiCallCount} calls\n`);
            
        } catch (error) {
            console.error(`   ❌ ${modeName} failed:`, error.message);
            results[modeName] = {
                error: error.message,
                apiCallCount,
                errors: errors.length
            };
        }
    }
    
    // Compare results
    console.log('📊 Performance Comparison Results:');
    console.log('=' .repeat(80));
    
    const toggleOff = results['Toggle OFF'];
    const toggleOn = results['Toggle ON'];
    
    if (toggleOff.error || toggleOn.error) {
        console.log('❌ One or both tests failed:');
        if (toggleOff.error) console.log(`   Toggle OFF: ${toggleOff.error}`);
        if (toggleOn.error) console.log(`   Toggle ON: ${toggleOn.error}`);
        return;
    }
    
    console.log('| Metric | Toggle OFF | Toggle ON | Improvement | Winner |');
    console.log('|--------|------------|-----------|-------------|--------|');
    
    // Total Time
    const timeImprovement = ((toggleOn.totalTime - toggleOff.totalTime) / toggleOn.totalTime * 100);
    console.log(`| Total Time | ${(toggleOff.totalTime/1000).toFixed(1)}s | ${(toggleOn.totalTime/1000).toFixed(1)}s | ${timeImprovement > 0 ? '+' : ''}${timeImprovement.toFixed(1)}% | ${toggleOff.totalTime < toggleOn.totalTime ? '🟢 OFF' : '🔴 ON'} |`);
    
    // API Calls
    const callImprovement = ((toggleOn.apiCallCount - toggleOff.apiCallCount) / toggleOn.apiCallCount * 100);
    console.log(`| API Calls | ${toggleOff.apiCallCount} | ${toggleOn.apiCallCount} | ${callImprovement > 0 ? '+' : ''}${callImprovement.toFixed(1)}% | ${toggleOff.apiCallCount < toggleOn.apiCallCount ? '🟢 OFF' : '🔴 ON'} |`);
    
    // Blocks per Call
    const batchImprovement = ((toggleOff.avgBlocksPerCall - toggleOn.avgBlocksPerCall) / toggleOn.avgBlocksPerCall * 100);
    console.log(`| Avg Blocks/Call | ${toggleOff.avgBlocksPerCall.toFixed(1)} | ${toggleOn.avgBlocksPerCall.toFixed(1)} | ${batchImprovement > 0 ? '+' : ''}${batchImprovement.toFixed(1)}% | ${toggleOff.avgBlocksPerCall > toggleOn.avgBlocksPerCall ? '🟢 OFF' : '🔴 ON'} |`);
    
    // Blocks per Second
    const throughputImprovement = ((toggleOff.blocksPerSecond - toggleOn.blocksPerSecond) / toggleOn.blocksPerSecond * 100);
    console.log(`| Blocks/Second | ${toggleOff.blocksPerSecond.toFixed(1)} | ${toggleOn.blocksPerSecond.toFixed(1)} | ${throughputImprovement > 0 ? '+' : ''}${throughputImprovement.toFixed(1)}% | ${toggleOff.blocksPerSecond > toggleOn.blocksPerSecond ? '🟢 OFF' : '🔴 ON'} |`);
    
    // Max Batch Size
    console.log(`| Max Batch Size | ${toggleOff.maxBatch} | ${toggleOn.maxBatch} | - | ${toggleOff.maxBatch > toggleOn.maxBatch ? '🟢 OFF' : '🔴 ON'} |`);
    
    // Success Rate
    console.log(`| Success Rate | ${toggleOff.successRate.toFixed(1)}% | ${toggleOn.successRate.toFixed(1)}% | - | ${toggleOff.successRate >= toggleOn.successRate ? '🟢 OFF' : '🔴 ON'} |`);
    
    console.log('\n📈 Detailed Analysis:');
    
    // Performance Analysis
    if (toggleOff.totalTime < toggleOn.totalTime) {
        const speedup = (toggleOn.totalTime / toggleOff.totalTime);
        console.log(`🚀 Toggle OFF is ${speedup.toFixed(1)}x faster than Toggle ON`);
    } else {
        console.log(`⚠️  Toggle ON is not slower than Toggle OFF (unexpected)`);
    }
    
    // Batching Analysis
    if (toggleOff.avgBlocksPerCall > toggleOn.avgBlocksPerCall) {
        const batchEfficiency = (toggleOff.avgBlocksPerCall / toggleOn.avgBlocksPerCall);
        console.log(`📦 Toggle OFF has ${batchEfficiency.toFixed(1)}x better batching efficiency`);
    }
    
    // API Efficiency
    if (toggleOff.apiCallCount < toggleOn.apiCallCount) {
        const apiEfficiency = (toggleOn.apiCallCount / toggleOff.apiCallCount);
        console.log(`📡 Toggle OFF uses ${apiEfficiency.toFixed(1)}x fewer API calls`);
    }
    
    console.log('\n🎯 Conclusions:');
    
    if (toggleOff.avgBlocksPerCall > 50) {
        console.log('✅ Toggle OFF uses efficient batching (>50 blocks per call)');
    } else {
        console.log('⚠️  Toggle OFF batching is not as efficient as expected');
    }
    
    if (toggleOff.totalTime < toggleOn.totalTime * 0.5) {
        console.log('✅ Toggle OFF provides significant performance improvement');
    } else if (toggleOff.totalTime < toggleOn.totalTime) {
        console.log('🟡 Toggle OFF provides moderate performance improvement');
    } else {
        console.log('🔴 Toggle OFF does not improve performance (unexpected)');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('• For large documents: Use Toggle OFF for better performance');
    console.log('• For hierarchical structure: Use Toggle ON for better organization');
    console.log('• Consider automatic mode switching based on document size');
    
    console.log(`\n🔗 View results: https://notion.so/${process.env.NOTION_PAGE_ID.replace(/-/g, '')}`);
}

compareTogglePerformance();