import { promises as fs } from 'fs';
import path from 'path';
import type { WorkspaceSummary, Finding } from '@contextos/types';

interface EvalResult {
  testName: string;
  score: number;
  passed: boolean;
  details: Record<string, unknown>;
}

interface ExpectedOutputs {
  expectedOutputs: {
    workspaceSummary: {
      minEntities: number;
      minRelationships: number;
      expectedEntities: Array<{ type: string; name: string }>;
      expectedRelationships: Array<{ type: string; sourceEntity: string; targetEntity: string }>;
    };
    qualityFindings: {
      minFindings: number;
    };
    sourceReferences: {
      minCoverage: number;
    };
  };
  scoringWeights: Record<string, number>;
  passingThreshold: number;
}

export async function runEval(testName: string): Promise<void> {
  console.log(`🧪 Running evaluation: ${testName}\n`);

  if (testName !== 'vertical-slice-001') {
    throw new Error(`Unknown test: ${testName}`);
  }

  // Load expected outputs
  const { rootDir } = await import('../bootstrap.js');
  const expectedPath = path.join(rootDir, 'evals', `${testName}.expected.json`);
  const expected: ExpectedOutputs = JSON.parse(await fs.readFile(expectedPath, 'utf-8'));

  // Run demo and capture outputs
  console.log('📁 Running demo on checkout-system...\n');
  await runDemo();

  // Load actual outputs
  const outputDir = path.join(
    rootDir,
    'demo-workspaces/checkout-system/output'
  );
  
  console.log('\n📊 Loading outputs and calculating scores...\n');
  
  const workspaceSummary: WorkspaceSummary = JSON.parse(
    await fs.readFile(path.join(outputDir, 'workspace-summary.json'), 'utf-8')
  );
  
  const relationshipGraph = JSON.parse(
    await fs.readFile(path.join(outputDir, 'relationship-graph.json'), 'utf-8')
  );
  
  const findings: Finding[] = JSON.parse(
    await fs.readFile(path.join(outputDir, 'findings.json'), 'utf-8')
  );
  
  const dfdContent = await fs.readFile(
    path.join(outputDir, 'dfd-level-0.mmd'),
    'utf-8'
  );

  // Calculate scores
  const results: EvalResult[] = [];

  results.push(await scoreEntityRecall(workspaceSummary, expected));
  results.push(await scoreRelationshipRecall(relationshipGraph, expected));
  results.push(await scoreFindingDetection(findings, expected));
  results.push(await scoreIrrelevantDetection(workspaceSummary));
  results.push(await scoreMermaidValidity(dfdContent));
  results.push(await scoreSourceReferences(relationshipGraph, expected));
  results.push(await scoreSchemaValidity(outputDir));

  // Calculate weighted total score
  const weights = expected.scoringWeights;
  const totalScore = results.reduce((sum, result) => {
    const weight = weights[camelCase(result.testName)] || 0;
    return sum + result.score * weight;
  }, 0);

  // Print results
  printEvalResults(results, totalScore, expected.passingThreshold);

  // Save report
  const report = {
    testName,
    evaluatedAt: new Date().toISOString(),
    totalScore,
    passed: totalScore >= expected.passingThreshold,
    passingThreshold: expected.passingThreshold,
    results,
    workspaceOutputs: {
      totalEntities: workspaceSummary.totalEntities,
      totalRelationships: workspaceSummary.totalRelationships,
      totalFindings: findings.length,
    },
  };

  const evalReportPath = path.join(rootDir, 'eval-report.json');
  await fs.writeFile(evalReportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved to ${evalReportPath}`);

  if (!report.passed) {
    console.error(`\n❌ Evaluation failed. Score ${(totalScore * 100).toFixed(1)}% below threshold ${(expected.passingThreshold * 100).toFixed(0)}%`);
    process.exit(1);
  }
}

async function runDemo(): Promise<void> {
  const { AnalyzeCommand } = await import('./demo.js');
  const { rootDir } = await import('../bootstrap.js');
  const workspacePath = path.join(
    rootDir,
    'demo-workspaces/checkout-system'
  );
  const analyzeCommand = new AnalyzeCommand();
  await analyzeCommand.execute(workspacePath);
}

async function scoreEntityRecall(
  summary: WorkspaceSummary, 
  expected: ExpectedOutputs
): Promise<EvalResult> {
  const minEntities = expected.expectedOutputs.workspaceSummary.minEntities;
  
  // Calculate score as percentage of minimum entities extracted
  const score = Math.min(summary.totalEntities / minEntities, 1.0);
  
  return {
    testName: 'Entity Recall',
    score,
    passed: score >= 0.8,
    details: {
      expected: minEntities,
      actual: summary.totalEntities,
      extractedTypes: summary.entitiesByType,
    },
  };
}

async function scoreRelationshipRecall(
  graph: { nodes?: unknown[]; edges?: unknown[] }, 
  expected: ExpectedOutputs
): Promise<EvalResult> {
  const minRelationships = expected.expectedOutputs.workspaceSummary.minRelationships;
  const actual = graph.edges?.length || 0;
  
  const score = Math.min(actual / minRelationships, 1.0);
  
  return {
    testName: 'Relationship Recall',
    score,
    passed: score >= 0.8,
    details: {
      expected: minRelationships,
      actual,
    },
  };
}

async function scoreFindingDetection(
  findings: Finding[], 
  expected: ExpectedOutputs
): Promise<EvalResult> {
  const minFindings = expected.expectedOutputs.qualityFindings.minFindings;
  const score = Math.min(findings.length / minFindings, 1.0);
  
  return {
    testName: 'Finding Detection',
    score,
    passed: score >= 0.5,
    details: {
      expected: minFindings,
      actual: findings.length,
      types: findings.map(f => f.type),
    },
  };
}

async function scoreIrrelevantDetection(
  summary: WorkspaceSummary
): Promise<EvalResult> {
  // Check if outdated sources were detected
  const score = summary.outdatedSources >= 1 ? 1.0 : 0.0;
  
  return {
    testName: 'Irrelevant Detection',
    score,
    passed: score >= 0.5,
    details: {
      outdatedSources: summary.outdatedSources,
    },
  };
}

async function scoreMermaidValidity(dfdContent: string): Promise<EvalResult> {
  // Basic Mermaid syntax check
  const hasFlowchart = dfdContent.includes('flowchart');
  const hasNodes = dfdContent.match(/\w+\[.*?\]/g);
  const hasEdges = dfdContent.match(/-->|---/g);
  
  const valid = hasFlowchart && (hasNodes?.length || 0) > 0 && (hasEdges?.length || 0) > 0;
  
  return {
    testName: 'Mermaid Validity',
    score: valid ? 1.0 : 0.0,
    passed: valid,
    details: {
      hasFlowchart,
      nodeCount: hasNodes?.length || 0,
      edgeCount: hasEdges?.length || 0,
    },
  };
}

async function scoreSourceReferences(
  graph: { nodes?: Array<{ sources?: unknown[] }>; edges?: Array<{ sources?: unknown[] }> }, 
  expected: ExpectedOutputs
): Promise<EvalResult> {
  const minCoverage = expected.expectedOutputs.sourceReferences.minCoverage;

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const nodesWithRefs = nodes.filter(n => n.sources && n.sources.length > 0);
  const edgesWithRefs = edges.filter(e => e.sources && e.sources.length > 0);

  const totalItems = nodes.length + edges.length;
  const itemsWithRefs = nodesWithRefs.length + edgesWithRefs.length;
  const coverage = totalItems > 0 ? itemsWithRefs / totalItems : 0;
  const score = Math.min(coverage / minCoverage, 1.0);
  
  return {
    testName: 'Source References',
    score,
    passed: score >= 0.8,
    details: {
      expectedCoverage: minCoverage,
      actualCoverage: coverage,
      nodesWithRefs: nodesWithRefs.length,
      totalNodes: nodes.length,
      edgesWithRefs: edgesWithRefs.length,
      totalEdges: edges.length,
    },
  };
}

async function scoreSchemaValidity(outputDir: string): Promise<EvalResult> {
  // Check if output files are valid JSON
  const files = ['workspace-summary.json', 'relationship-graph.json', 'findings.json'];
  let validCount = 0;
  
  for (const file of files) {
    try {
      JSON.parse(await fs.readFile(path.join(outputDir, file), 'utf-8'));
      validCount++;
    } catch {
      // Invalid JSON
    }
  }
  
  const score = validCount / files.length;
  
  return {
    testName: 'Schema Validity',
    score,
    passed: score === 1.0,
    details: {
      validFiles: validCount,
      totalFiles: files.length,
    },
  };
}

function printEvalResults(results: EvalResult[], totalScore: number, threshold: number): void {
  console.log('Evaluation Results:');
  console.log('═'.repeat(80));
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const score = (result.score * 100).toFixed(1);
    console.log(`${icon} ${result.testName.padEnd(25)} ${score}%`);
  }
  
  console.log('═'.repeat(80));
  const totalPercent = (totalScore * 100).toFixed(1);
  const passIcon = totalScore >= threshold ? '✅' : '❌';
  console.log(`${passIcon} Total Score: ${totalPercent}% (threshold: ${(threshold * 100).toFixed(0)}%)`);
}

function camelCase(str: string): string {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
    index === 0 ? match.toLowerCase() : match.toUpperCase()
  ).replace(/\s+/g, '');
}
