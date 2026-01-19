import https from 'https';

export interface FigmaNodeContent {
  nodeId: string;
  html?: string;
  text?: string;
  type: 'TEXT' | 'FRAME' | 'COMPONENT' | 'INSTANCE' | 'GROUP' | 'OTHER';
}

export interface FigmaFetchResult {
  nodes: FigmaNodeContent[];
  combinedHtml: string;
}

/**
 * Fetches content from Figma nodes using Figma REST API
 * @param figmaFileKey - The file key from Figma URL (e.g., "abc123def456")
 * @param nodeIds - Array of node IDs to fetch (e.g., ["1:23", "2:45"])
 * @param figmaAccessToken - Personal access token from Figma account settings
 * @returns Combined HTML content from all nodes
 */
export async function fetchFigmaContent(
  figmaFileKey: string,
  nodeIds: string[],
  figmaAccessToken: string
): Promise<FigmaFetchResult> {
  if (!figmaAccessToken) {
    throw new Error('FIGMA_ACCESS_TOKEN environment variable is required');
  }

  // Figma API endpoint: GET /v1/files/:file_key/nodes
  const nodeIdsQuery = nodeIds.map(id => `ids=${encodeURIComponent(id)}`).join('&');
  const url = `https://api.figma.com/v1/files/${figmaFileKey}/nodes?${nodeIdsQuery}`;

  const response = await httpsGet(url, {
    'X-Figma-Token': figmaAccessToken,
  });

  const data = JSON.parse(response);

  if (data.err) {
    throw new Error(`Figma API error: ${data.err}`);
  }

  const nodes: FigmaNodeContent[] = [];
  const htmlParts: string[] = [];

  // Extract text content from each node
  for (const nodeId of nodeIds) {
    const nodeData = data.nodes[nodeId];
    if (!nodeData || !nodeData.document) {
      console.warn(`Node ${nodeId} not found in Figma response`);
      continue;
    }

    const doc = nodeData.document;
    const content = extractNodeContent(doc);
    nodes.push(content);

    // Build HTML from node content
    if (content.html) {
      htmlParts.push(content.html);
    } else if (content.text) {
      htmlParts.push(`<div class="figma-node figma-${content.type.toLowerCase()}">${escapeHtml(content.text)}</div>`);
    }
  }

  const combinedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Content</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .figma-node {
      margin-bottom: 16px;
    }
    .figma-text {
      font-size: 14px;
      line-height: 1.5;
    }
    .figma-frame, .figma-component {
      border: 1px solid #e0e0e0;
      padding: 12px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  ${htmlParts.join('\n  ')}
</body>
</html>`.trim();

  return { nodes, combinedHtml };
}

/**
 * Extract text/HTML content from a Figma node recursively
 */
function extractNodeContent(node: any): FigmaNodeContent {
  const nodeId = node.id || 'unknown';
  const type = node.type || 'OTHER';

  // For TEXT nodes, extract characters
  if (type === 'TEXT' && node.characters) {
    return {
      nodeId,
      text: node.characters,
      type: 'TEXT',
    };
  }

  // For containers (FRAME, COMPONENT, etc.), recursively extract child content
  if (node.children && Array.isArray(node.children)) {
    const childTexts: string[] = [];
    for (const child of node.children) {
      const childContent = extractNodeContent(child);
      if (childContent.text) {
        childTexts.push(childContent.text);
      } else if (childContent.html) {
        childTexts.push(childContent.html);
      }
    }

    if (childTexts.length > 0) {
      const html = `<div class="figma-${type.toLowerCase()}">${childTexts.join('\n')}</div>`;
      return { nodeId, html, type: type as any };
    }
  }

  return { nodeId, type: type as any };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Make HTTPS GET request (Node.js native, no dependencies)
 */
function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers,
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}
