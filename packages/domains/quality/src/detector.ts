import type { Source, Finding, SourceReference } from '@contextos/types';

/**
 * QualityDetector identifies quality issues in sources
 */
export class QualityDetector {
  /**
   * Detect all quality issues in sources
   */
  async detectIssues(sources: Source[], workspaceId: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Detect duplicates
    const duplicates = this.detectDuplicates(sources, workspaceId);
    findings.push(...duplicates);

    // Detect outdated sources
    const outdated = this.detectOutdated(sources, workspaceId);
    findings.push(...outdated);

    // Detect conflicts
    const conflicts = this.detectConflicts(sources, workspaceId);
    findings.push(...conflicts);

    // Detect low relevance
    const lowRelevance = this.detectLowRelevance(sources, workspaceId);
    findings.push(...lowRelevance);

    return findings;
  }

  /**
   * Detect duplicate sources by comparing file hashes and content similarity
   */
  private detectDuplicates(sources: Source[], workspaceId: string): Finding[] {
    const findings: Finding[] = [];
    const hashGroups = new Map<string, Source[]>();

    // Group by file hash
    for (const source of sources) {
      const group = hashGroups.get(source.fileHash) ?? [];
      group.push(source);
      hashGroups.set(source.fileHash, group);
    }

    // Create findings for duplicate groups
    for (const [hash, group] of hashGroups.entries()) {
      if (group.length > 1) {
        const sourceRefs: SourceReference[] = group.map(s => ({
          sourceId: s.id,
          fileName: s.fileName,
        }));

        findings.push({
          id: `finding_dup_${hash}`,
          workspaceId,
          type: 'duplicate_source',
          severity: 'medium',
          title: `Duplicate content detected (${group.length} files)`,
          description: `These files have identical or very similar content: ${group.map(s => s.fileName).join(', ')}`,
          affectedSources: sourceRefs,
          recommendation: 'Review and keep only the most recent or authoritative version',
          autoFixAvailable: false,
          status: 'open',
          detectedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return findings;
  }

  /**
   * Detect outdated or deprecated sources
   */
  private detectOutdated(sources: Source[], workspaceId: string): Finding[] {
    const findings: Finding[] = [];

    for (const source of sources) {
      const isOutdated = this.isOutdatedSource(source);
      if (isOutdated) {
        findings.push({
          id: `finding_outdated_${source.id}`,
          workspaceId,
          type: 'outdated_source',
          severity: 'high',
          title: `Outdated documentation: ${source.fileName}`,
          description: 'This source appears to be deprecated or outdated',
          affectedSources: [{
            sourceId: source.id,
            fileName: source.fileName,
          }],
          recommendation: 'Verify if this document is still relevant or should be archived',
          autoFixAvailable: false,
          status: 'open',
          detectedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return findings;
  }

  /**
   * Check if source is outdated based on keywords and patterns
   */
  private isOutdatedSource(source: Source): boolean {
    const content = source.rawContent.toLowerCase();
    const fileName = source.fileName.toLowerCase();

    const outdatedKeywords = [
      'deprecated',
      'outdated',
      'legacy',
      'old flow',
      'before ',
      'no longer',
      'replaced by',
    ];

    return outdatedKeywords.some(keyword => 
      content.includes(keyword) || fileName.includes(keyword)
    );
  }

  /**
   * Detect conflicting information across sources
   */
  private detectConflicts(sources: Source[], workspaceId: string): Finding[] {
    const findings: Finding[] = [];

    // Group sources by category
    const apiDocs = sources.filter(s => s.category === 'api_documentation');
    
    // Simple conflict detection: multiple API docs might conflict
    if (apiDocs.length > 1) {
      // Check for similar file names (might be different versions)
      const nameGroups = new Map<string, Source[]>();
      
      for (const doc of apiDocs) {
        const baseName = this.getBaseName(doc.fileName);
        const group = nameGroups.get(baseName) ?? [];
        group.push(doc);
        nameGroups.set(baseName, group);
      }

      for (const [baseName, group] of nameGroups.entries()) {
        if (group.length > 1) {
          // Different files with similar names might conflict
          const sourceRefs: SourceReference[] = group.map(s => ({
            sourceId: s.id,
            fileName: s.fileName,
          }));

          findings.push({
            id: `finding_conflict_${baseName}_${Date.now()}`,
            workspaceId,
            type: 'conflicting_info',
            severity: 'high',
            title: `Potential conflicting API documentation`,
            description: `Multiple API specification files found: ${group.map(s => s.fileName).join(', ')}. These may contain conflicting information.`,
            affectedSources: sourceRefs,
            recommendation: 'Review these documents and ensure they are consistent, or mark one as deprecated',
            autoFixAvailable: false,
            status: 'open',
            detectedAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    return findings;
  }

  /**
   * Detect sources with low relevance scores
   */
  private detectLowRelevance(sources: Source[], workspaceId: string): Finding[] {
    const findings: Finding[] = [];

    for (const source of sources) {
      if (source.relevanceScore !== undefined && source.relevanceScore < 0.3) {
        findings.push({
          id: `finding_lowrel_${source.id}`,
          workspaceId,
          type: 'low_confidence',
          severity: 'low',
          title: `Low relevance: ${source.fileName}`,
          description: `This source has a low relevance score (${source.relevanceScore.toFixed(2)}) and may not be useful for understanding the system`,
          affectedSources: [{
            sourceId: source.id,
            fileName: source.fileName,
          }],
          recommendation: 'Consider excluding this source from analysis or recategorizing it',
          autoFixAvailable: false,
          status: 'open',
          detectedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return findings;
  }

  /**
   * Extract base name from file (without extension and version markers)
   */
  private getBaseName(fileName: string): string {
    return fileName
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]v?\d+(\.\d+)*$/, '') // Remove version numbers
      .replace(/[-_](old|new|latest|draft|final)$/i, '') // Remove common suffixes
      .toLowerCase();
  }
}
