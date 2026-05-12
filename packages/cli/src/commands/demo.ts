import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { Source, Entity, Relationship, WorkspaceSummary, Finding, Artifact, RelationshipGraph, AnalysisManifest, ManifestCapabilities, ManifestSourceEntry, SourceProfile, WorkspaceContext, SourceRelationshipMap } from '@contextos/types';
import { SourceRelationshipMapper } from '@contextos/relationships';
import { parserRegistry } from '@contextos/parsers';
import { SourceClassifier } from '@contextos/classifier';
import { EntityExtractor } from '@contextos/extractor';
import { RelationshipMapper, DFDGenerator } from '@contextos/generator';
import { QualityDetector } from '@contextos/quality';
import { SourceProfiler, WorkspaceContextBuilder } from '@contextos/profiler';
import { WorkspaceReportGenerator } from '@contextos/qa';

/**
 * AnalyzeCommand orchestrates the full analysis pipeline
 */
export class AnalyzeCommand {
  async execute(workspacePath: string): Promise<void> {
    console.log('🚀 ContextOS Analysis - Workspace Intelligence\n');
    console.log(`📁 Workspace: ${workspacePath}\n`);

    // Step 1: Load workspace
    console.log('Step 1: Loading workspace...');
    const workspace = await this.loadWorkspace(workspacePath);
    console.log(`✅ Found ${workspace.sources.length} files\n`);

    // Step 2: Parse sources
    console.log('Step 2: Parsing sources...');
    const sources = await this.parseSources(workspace.sources);
    console.log(`✅ Parsed ${sources.length} sources\n`);

    // Step 2.5: Profile sources (VS005)
    console.log('Step 2.5: Profiling sources...');
    const profiler = new SourceProfiler();
    const sourceProfiles = profiler.profileAll(sources);
    console.log(`✅ Profiled ${sourceProfiles.length} source(s)\n`);

    // Partition: structured-data files are analysed via dedicated pipelines
    const STRUCTURED_DATA_TYPES = new Set(['xlsx', 'csv']);
    const hasDocuments = sources.some(s => !STRUCTURED_DATA_TYPES.has(s.fileType));

    let classifiedSources: Source[] = sources;
    let entities: Entity[] = [];
    let relationships: Relationship[] = [];
    let mergedEntities: Entity[] = [];
    let mergedRelationships: Relationship[] = [];
    let graph: RelationshipGraph | null = null;
    let findings: Finding[] = [];
    let dfd: Artifact | null = null;

    if (hasDocuments) {
      // Step 3: Classify sources
      console.log('Step 3: Classifying sources...');
      const classifier = new SourceClassifier();
      classifiedSources = await this.classifySources(sources, classifier);
      console.log(`✅ Classified sources by category\n`);

      // Step 4: Extract entities and relationships
      console.log('Step 4: Extracting entities and relationships...');
      const extractor = new EntityExtractor();
      ({ entities, relationships } = await this.extractEntitiesAndRelationships(
        classifiedSources,
        extractor,
        workspace.id
      ));
      console.log(`✅ Extracted ${entities.length} entities and ${relationships.length} relationships\n`);

      // Step 5: Build relationship graph
      console.log('Step 5: Building relationship graph...');
      const mapper = new RelationshipMapper();
      mergedEntities = mapper.mergeEntities(entities);
      mergedRelationships = mapper.mergeRelationships(relationships);
      graph = mapper.buildGraph(mergedEntities, mergedRelationships, workspace.id);
      console.log(`✅ Built graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges\n`);

      // Step 6: Detect quality issues
      console.log('Step 6: Detecting quality issues...');
      const detector = new QualityDetector();
      findings = await detector.detectIssues(classifiedSources, workspace.id);
      console.log(`✅ Found ${findings.length} quality issues\n`);

      // Step 7: Generate DFD
      console.log('Step 7: Generating Data Flow Diagram...');
      const generator = new DFDGenerator();
      dfd = generator.generateLevel0(mergedEntities, mergedRelationships, workspace.id);
      console.log(`✅ Generated DFD Level 0\n`);
    } else {
      console.log('ℹ️  Only structured-data files found — skipping document analysis (Steps 3–7).\n');
    }

    // Step 8: Create workspace summary
    console.log('Step 8: Creating workspace summary...');
    const summary = this.createWorkspaceSummary(
      workspace,
      classifiedSources,
      mergedEntities,
      mergedRelationships,
      findings
    );
    console.log(`✅ Summary created\n`);

    // Step 8.5: Build workspace context (VS005)
    console.log('Step 8.5: Building workspace context...');
    const contextBuilder = new WorkspaceContextBuilder();
    const workspaceContext = contextBuilder.build(workspace.id, sourceProfiles, sources);
    console.log(`✅ Workspace context built — theme: "${workspaceContext.primaryTheme}"\n`);

    // Step 8.7: Map cross-source relationships (VS007)
    console.log('Step 8.7: Mapping cross-source relationships...');
    const relationshipMapper = new SourceRelationshipMapper();
    const sourceRelationships = relationshipMapper.compute(workspace.id, sourceProfiles);
    console.log(`✅ Found ${sourceRelationships.relationships.length} cross-source relationship(s)\n`);

    // Step 9: Write outputs
    console.log('Step 9: Writing outputs...');
    await this.writeOutputs(workspacePath, {
      summary,
      graph,
      findings,
      dfd,
      sourceProfiles,
      workspaceContext,
      sourceRelationships,
    });
    await this.writeExcelOutputs(workspacePath, sources);
    await this.writeExtractedText(workspacePath, sources);
    await this.writeReport(workspacePath);

    // Step 10: Write analysis manifest
    console.log('Step 10: Writing analysis manifest...');
    await this.writeManifest(workspacePath, workspace, sources);

    console.log(`✅ Outputs written to ${workspacePath}/output/\n`);

    console.log('✨ Demo complete!\n');
    this.printSummary(summary);
  }

  private async loadWorkspace(workspacePath: string): Promise<{
    id: string;
    sources: Array<{ filePath: string; fileName: string }>;
  }> {
    // Prefer sources/ subdir if it exists (user-created workspaces)
    const sourcesDir = path.join(workspacePath, 'sources');
    let readDir = workspacePath;
    try {
      const stat = await fs.stat(sourcesDir);
      if (stat.isDirectory()) readDir = sourcesDir;
    } catch {
      // sources/ doesn't exist — read from root (backward compat)
    }

    const files = await fs.readdir(readDir);
    const sources = files
      .filter(f => !f.startsWith('.') && f !== 'output')
      .map(f => ({
        filePath: path.join(readDir, f),
        fileName: f,
      }));

    return {
      id: `ws_${Date.now()}`,
      sources,
    };
  }

  private async parseSources(sourceFiles: Array<{ filePath: string; fileName: string }>): Promise<Source[]> {
    const sources: Source[] = [];
    const BINARY_TYPES = new Set(['xlsx', 'pdf', 'docx']);

    for (const file of sourceFiles) {
      try {
        const fileType = this.detectFileType(file.fileName);

        if (BINARY_TYPES.has(fileType)) {
          // Binary files: parser reads from filePath directly — no UTF-8 read
          const source = await parserRegistry.parseSource({
            fileName: file.fileName,
            filePath: file.filePath,
            fileType,
          });
          sources.push(source);
        } else {
          const content = await fs.readFile(file.filePath, 'utf-8');
          const source = await parserRegistry.parseSource({
            fileName: file.fileName,
            filePath: file.filePath,
            fileType,
            rawContent: content,
          });
          sources.push(source);
        }
      } catch (error) {
        console.error(`  ⚠️  Failed to parse ${file.fileName}:`, error);
      }
    }

    return sources;
  }

  private detectFileType(fileName: string): any {
    if (fileName.endsWith('.md')) return 'markdown';
    if (fileName.endsWith('.csv')) return 'csv';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.xlsx')) return 'xlsx';
    if (fileName.endsWith('.pdf')) return 'pdf';
    if (fileName.endsWith('.docx')) return 'docx';
    if (fileName.endsWith('.txt')) return 'text';
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
    if (fileName.includes('.figma.')) return 'figma';
    if (fileName.includes('.confluence.')) return 'confluence';
    return 'unknown';
  }

  private async classifySources(sources: Source[], classifier: SourceClassifier): Promise<Source[]> {
    return await classifier.classifyBatch(sources);
  }

  private async extractEntitiesAndRelationships(
    sources: Source[],
    extractor: EntityExtractor,
    workspaceId: string
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const allEntities: Entity[] = [];
    const allRelationships: Relationship[] = [];

    // Only extract from relevant sources
    const relevantSources = sources.filter(s => 
      s.category !== 'irrelevant' && (s.relevanceScore ?? 0) > 0.5
    );

    for (const source of relevantSources) {
      const { entities, relationships } = await extractor.extract(source, workspaceId);
      allEntities.push(...entities);
      allRelationships.push(...relationships);
    }

    return { entities: allEntities, relationships: allRelationships };
  }

  private createWorkspaceSummary(
    workspace: { id: string },
    sources: Source[],
    entities: Entity[],
    relationships: Relationship[],
    findings: Finding[]
  ): WorkspaceSummary {
    const sourcesByType: Record<string, number> = {};
    const sourcesByCategory: Record<string, number> = {};
    const entitiesByType: Record<string, number> = {};
    const relationshipsByType: Record<string, number> = {};

    for (const source of sources) {
      sourcesByType[source.fileType] = (sourcesByType[source.fileType] ?? 0) + 1;
      if (source.category) {
        sourcesByCategory[source.category] = (sourcesByCategory[source.category] ?? 0) + 1;
      }
    }

    for (const entity of entities) {
      entitiesByType[entity.type] = (entitiesByType[entity.type] ?? 0) + 1;
    }

    for (const rel of relationships) {
      relationshipsByType[rel.type] = (relationshipsByType[rel.type] ?? 0) + 1;
    }

    const actors = entities.filter(e => e.type === 'actor').map(e => e.name).slice(0, 5);
    const systems = entities.filter(e => e.type === 'system').map(e => e.name).slice(0, 5);
    const externals = entities.filter(e => e.type === 'external_integration').map(e => e.name);

    return {
      workspaceId: workspace.id,
      workspaceName: 'Checkout System',
      totalSources: sources.length,
      sourcesByType,
      sourcesByCategory,
      totalEntities: entities.length,
      entitiesByType,
      totalRelationships: relationships.length,
      relationshipsByType,
      duplicateSources: findings.filter(f => f.type === 'duplicate_source').length,
      outdatedSources: findings.filter(f => f.type === 'outdated_source').length,
      conflictingSources: findings.filter(f => f.type === 'conflicting_info').length,
      primaryActors: actors,
      primarySystems: systems,
      externalIntegrations: externals,
      generatedAt: new Date(),
    };
  }

  private async writeOutputs(
    workspacePath: string,
    outputs: {
      summary: WorkspaceSummary;
      graph: RelationshipGraph | null;
      findings: Finding[];
      dfd: Artifact | null;
      sourceProfiles: SourceProfile[];
      workspaceContext: WorkspaceContext;
      sourceRelationships: SourceRelationshipMap;
    }
  ): Promise<void> {
    const outputDir = path.join(workspacePath, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Write workspace summary
    await fs.writeFile(
      path.join(outputDir, 'workspace-summary.json'),
      JSON.stringify(outputs.summary, null, 2)
    );

    // Write relationship graph (only when document analysis ran)
    if (outputs.graph) {
      await fs.writeFile(
        path.join(outputDir, 'relationship-graph.json'),
        JSON.stringify(outputs.graph, null, 2)
      );
    }

    // Write findings (only when there are issues to report)
    if (outputs.findings.length > 0) {
      await fs.writeFile(
        path.join(outputDir, 'findings.json'),
        JSON.stringify(outputs.findings, null, 2)
      );
    }

    // Write DFD (only when document analysis ran)
    if (outputs.dfd) {
      await fs.writeFile(
        path.join(outputDir, 'dfd-level-0.mmd'),
        outputs.dfd.content
      );
    }

    // Write source profiles (VS005)
    await fs.writeFile(
      path.join(outputDir, 'source-profiles.json'),
      JSON.stringify(outputs.sourceProfiles, null, 2)
    );
    console.log(`  📑 Wrote source-profiles.json (${outputs.sourceProfiles.length} profiles)`);

    // Write workspace context (VS005)
    await fs.writeFile(
      path.join(outputDir, 'workspace-context.json'),
      JSON.stringify(outputs.workspaceContext, null, 2)
    );
    console.log(`  🌐 Wrote workspace-context.json`);

    // Write source relationships (VS007)
    await fs.writeFile(
      path.join(outputDir, 'workspace-relationships.json'),
      JSON.stringify(outputs.sourceRelationships, null, 2)
    );
    console.log(`  🔗 Wrote workspace-relationships.json (${outputs.sourceRelationships.relationships.length} relationships)`);
  }

  private async writeExcelOutputs(
    workspacePath: string,
    sources: Source[],
  ): Promise<void> {
    const excelSources = sources.filter(s => s.fileType === 'xlsx');
    if (excelSources.length === 0) return;

    const outputDir = path.join(workspacePath, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Aggregate profiles and observations from all xlsx sources
    const profiles = [];
    const allObservations = [];

    for (const src of excelSources) {
      const sd = src.structuredData as Record<string, unknown> | undefined;
      if (sd?.workbookProfile) {
        profiles.push(sd.workbookProfile);
      }
      if (sd?.normalizedObservations && Array.isArray(sd.normalizedObservations)) {
        allObservations.push(...(sd.normalizedObservations as unknown[]));
      }
    }

    if (profiles.length > 0) {
      await fs.writeFile(
        path.join(outputDir, 'workbook-profile.json'),
        JSON.stringify(profiles.length === 1 ? profiles[0] : profiles, null, 2)
      );
      console.log(`  📊 Wrote workbook-profile.json (${profiles.length} workbook${profiles.length > 1 ? 's' : ''})`);
    }

    if (allObservations.length > 0) {
      await fs.writeFile(
        path.join(outputDir, 'normalized-observations.json'),
        JSON.stringify(allObservations, null, 2)
      );
      console.log(`  📋 Wrote normalized-observations.json (${allObservations.length} observations)`);
    }
  }

  /**
   * Persist extracted text from PDF/DOCX sources so Q&A retriever can search them.
   */
  private async writeExtractedText(
    workspacePath: string,
    sources: Source[],
  ): Promise<void> {
    const extractable = sources.filter(
      s => (s.fileType === 'pdf' || s.fileType === 'docx') && s.rawContent,
    );
    if (extractable.length === 0) return;

    const textDir = path.join(workspacePath, 'output', 'extracted-text');
    await fs.mkdir(textDir, { recursive: true });

    for (const src of extractable) {
      await fs.writeFile(
        path.join(textDir, `${src.fileName}.txt`),
        src.rawContent,
      );
    }
    console.log(`  📝 Wrote extracted-text/ (${extractable.length} file${extractable.length > 1 ? 's' : ''})`);
  }

  private async writeReport(workspacePath: string): Promise<void> {
    const outputDir = path.join(workspacePath, 'output');
    const sourcesDir = path.join(workspacePath, 'sources');
    const generator = new WorkspaceReportGenerator(outputDir, sourcesDir);
    const markdown = generator.generate();
    await fs.writeFile(path.join(outputDir, 'workspace-report.md'), markdown);
    console.log(`  📄 Wrote workspace-report.md`);
  }

  private async writeManifest(
    workspacePath: string,
    workspace: { id: string; sources: Array<{ filePath: string; fileName: string }> },
    sources: Source[],
  ): Promise<void> {
    const outputDir = path.join(workspacePath, 'output');

    // Compute source file hashes
    const sourceEntries: ManifestSourceEntry[] = [];
    for (const src of workspace.sources) {
      try {
        const buf = fsSync.readFileSync(src.filePath);
        sourceEntries.push({
          fileName: src.fileName,
          fileType: this.detectFileType(src.fileName),
          hash: createHash('sha256').update(buf).digest('hex'),
          size: buf.length,
        });
      } catch {
        // skip files that can't be read
      }
    }

    // Detect which artifacts were written
    const artifactFiles = [
      'workspace-summary.json',
      'relationship-graph.json',
      'findings.json',
      'dfd-level-0.mmd',
      'workbook-profile.json',
      'normalized-observations.json',
      'source-profiles.json',
      'workspace-context.json',
      'workspace-relationships.json',
      'workspace-report.md',
    ];
    const existingArtifacts: string[] = [];
    for (const f of artifactFiles) {
      try {
        await fs.stat(path.join(outputDir, f));
        existingArtifacts.push(f);
      } catch {
        // artifact not written
      }
    }

    const hasExcel = sources.some(s => s.fileType === 'xlsx');
    const capabilities: ManifestCapabilities = {
      hasExcel,
      hasWorkbookProfile: existingArtifacts.includes('workbook-profile.json'),
      hasNormalizedObservations: existingArtifacts.includes('normalized-observations.json'),
      hasDfd: existingArtifacts.includes('dfd-level-0.mmd'),
      hasGraph: existingArtifacts.includes('relationship-graph.json'),
      hasFindings: existingArtifacts.includes('findings.json'),
      hasEval: false,
      hasSourceProfiles: existingArtifacts.includes('source-profiles.json'),
      hasWorkspaceContext: existingArtifacts.includes('workspace-context.json'),
      hasSourceRelationships: existingArtifacts.includes('workspace-relationships.json'),
      hasReport: existingArtifacts.includes('workspace-report.md'),
    };

    const manifest: AnalysisManifest = {
      workspaceId: workspace.id,
      runId: `run_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      sourceFiles: sourceEntries,
      artifacts: existingArtifacts,
      capabilities,
    };

    await fs.writeFile(
      path.join(outputDir, 'analysis-manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    console.log(`  📋 Wrote analysis-manifest.json (${sourceEntries.length} sources, ${existingArtifacts.length} artifacts)`);
  }

  private printSummary(summary: WorkspaceSummary): void {
    console.log('📊 Workspace Summary:');
    console.log(`   ${summary.totalSources} sources analyzed`);
    console.log(`   ${summary.totalEntities} entities extracted`);
    console.log(`   ${summary.totalRelationships} relationships identified`);
    console.log('');
    console.log('🎯 Key Entities:');
    console.log(`   Actors: ${summary.primaryActors.join(', ') || 'None'}`);
    console.log(`   Systems: ${summary.primarySystems.join(', ') || 'None'}`);
    console.log(`   External Integrations: ${summary.externalIntegrations.join(', ') || 'None'}`);
    console.log('');
    console.log('⚠️  Quality Issues:');
    console.log(`   ${summary.duplicateSources} duplicate sources`);
    console.log(`   ${summary.outdatedSources} outdated sources`);
    console.log(`   ${summary.conflictingSources} conflicting sources`);
    console.log('');
  }
}
