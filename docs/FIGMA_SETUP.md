# Using Figma Integration with AIDQA

## Overview
AIDQA can capture screenshots from Figma designs and compare them against live web implementations. This helps identify visual inconsistencies between design and code.

---

## Prerequisites
1. Figma account (free or paid)
2. Access to the Figma file you want to test
3. Personal access token from Figma

---

## Step 1: Get Your Figma Access Token

### Instructions:
1. Open [Figma](https://www.figma.com/)
2. Click your profile icon → **Settings**
3. Scroll to **Personal Access Tokens**
4. Click **Create new token**
5. Give it a name (e.g., "AIDQA Visual Testing")
6. **Copy the token immediately** (you won't see it again!)

### Add to Environment:
```bash
# In your .env file (create from .env.example)
FIGMA_ACCESS_TOKEN=figd_your_token_here_xyz123
```

⚠️ **Security:** Never commit `.env` to version control. It's already in `.gitignore`.

---

## Step 2: Find Figma File Key & Node IDs

### File Key
The file key is in your Figma URL:
```
https://www.figma.com/design/ABC123DEF456/My-Design
                              ^^^^^^^^^^^^^
                              This is your file key
```

### Node IDs
To get node IDs for specific frames/components:

#### Method 1: Right-click Method
1. In Figma, **right-click** on a frame/component
2. Select **Copy link to selection**
3. The URL will look like:
   ```
   https://www.figma.com/design/ABC123DEF456/My-Design?node-id=1-23
                                                              ^^^^^
                                                              Node ID
   ```
4. Extract the part after `node-id=` (e.g., `1-23`)
5. **Important:** Replace the dash with a colon → `1:23`

#### Method 2: Figma Plugin
1. Install the **"Copy Node ID"** plugin from Figma Community
2. Select your frame/component
3. Run the plugin to copy the ID

#### Method 3: Dev Mode (Pro/Enterprise)
1. Enable **Dev Mode** in Figma (bottom-left)
2. Select your frame
3. The node ID appears in the panel (format: `1:23`)

---

## Step 3: Create a Baseline from Figma

### Using the UI (http://localhost:8080)

1. Go to the **Visual Regression (MVP)** panel
2. Select **Figma** (radio button)
3. Fill in:
   - **Project ID:** `my-app` (any identifier)
   - **Name:** `Homepage Hero Section`
   - **Figma File Key:** `ABC123DEF456`
   - **Node IDs:** `1:23, 2:45` (comma-separated for multiple)
   - **Viewport W/H:** `1440 x 900` (or your target size)
4. Click **Create baseline**
5. Copy the `baselineId` that appears

### Using curl (API directly)

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-app",
    "name": "Homepage Hero from Figma",
    "figmaSource": {
      "figmaFileKey": "ABC123DEF456",
      "figmaNodeIds": ["1:23", "2:45"]
    },
    "viewport": {
      "width": 1440,
      "height": 900
    }
  }'
```

**Response:**
```json
{
  "baselineId": "uuid-here",
  "projectId": "my-app",
  "name": "Homepage Hero from Figma",
  "figmaSource": {
    "figmaFileKey": "ABC123DEF456",
    "figmaNodeIds": ["1:23", "2:45"]
  },
  "viewport": { "width": 1440, "height": 900 },
  "baselineImagePath": "/storage/visual/my-app/uuid-here/baseline.png",
  "createdAt": "2026-01-19T12:34:56.789Z"
}
```

---

## Step 4: Compare Live Implementation

### Option A: Compare Against Live URL

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines/{baselineId}/runs \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://staging.myapp.com/homepage",
    "viewport": { "width": 1440, "height": 900 }
  }'
```

This will:
1. Fetch the Figma design (from baseline)
2. Capture screenshot of the live URL
3. Compare them pixel-by-pixel
4. Return diff with highlighted changes

### Option B: Compare Updated Figma Design

If you've updated the Figma design:

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines/{baselineId}/runs \
  -H "Content-Type: application/json" \
  -d '{
    "figmaSource": {
      "figmaFileKey": "ABC123DEF456",
      "figmaNodeIds": ["1:23"]
    }
  }'
```

---

## Step 5: View Results

### In the UI
1. Copy the `runId` from the response
2. Click **Open run viewer** (or navigate to):
   ```
   http://localhost:8080/visual/baselines/{baselineId}/runs/{runId}
   ```

### What You'll See:
- **Baseline Image:** Original Figma design
- **Current Image:** Live implementation (or updated Figma)
- **Diff Image:** Red pixels = mismatches
- **Metrics:**
  - `mismatchPixelCount`: Number of different pixels
  - `totalPixels`: Total pixels compared
  - `mismatchPercent`: Percentage difference
- **Status:**
  - `PASS`: Identical (0% mismatch)
  - `FAIL`: Visual differences detected
  - `ERROR`: Technical issue (e.g., dimension mismatch)

---

## Common Use Cases

### 1. Design Handoff Validation
**Goal:** Verify developers implemented design accurately

```bash
# 1. Create baseline from approved Figma design
POST /baselines { figmaSource: {...} }

# 2. Compare against staging URL
POST /baselines/{id}/runs { url: "https://staging..." }

# 3. Review diff → fix code → re-run
```

### 2. Design System Consistency
**Goal:** Ensure component instances match library

```bash
# Baseline: Figma component library button
figmaNodeIds: ["library-button-1:23"]

# Run: Actual button in design file
figmaNodeIds: ["instance-button-5:67"]
```

### 3. Regression Testing After Updates
**Goal:** Detect unintended changes after design tweaks

```bash
# Baseline: Version 1.0 of Figma design
# Run: Version 1.1 after designer's updates
# Diff shows what changed
```

---

## Limitations & Gotchas

### Current Limitations
- **No Auto-Layout Rendering:** Figma Auto Layout isn't rendered (just text extraction)
- **Limited Node Types:** Only TEXT, FRAME, COMPONENT, GROUP supported
- **No Images:** Figma images aren't downloaded (shows placeholders)
- **Styling Basic:** Extracted HTML has minimal CSS

### Workarounds
- **For complex components:** Use URL comparison instead (compare live Figma prototype vs live site)
- **For full fidelity:** Export Figma as PNG and use as baseline directly
- **For design tokens:** Use the Design System Analyzer feature

### Debugging
If Figma fetch fails:
```bash
# Check token validity
curl -H "X-Figma-Token: figd_your_token" \
  https://api.figma.com/v1/me

# Check file access
curl -H "X-Figma-Token: figd_your_token" \
  https://api.figma.com/v1/files/ABC123DEF456
```

---

## Advanced: Batch Testing

### Test Multiple Screens
```bash
# Create baselines for all app screens
screens=(
  "login:1:23"
  "dashboard:2:45"
  "settings:3:67"
)

for screen in "${screens[@]}"; do
  IFS=':' read -r name nodeId <<< "$screen"
  curl -X POST .../baselines -d '{
    "name": "'"$name"'",
    "figmaSource": { "figmaNodeIds": ["'"$nodeId"'"] }
  }'
done
```

### CI/CD Integration
```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Visual Tests
        env:
          FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_TOKEN }}
        run: |
          npm run dev:api &
          npm test:visual  # Your script to run all baselines
```

---

## Security Best Practices

1. **Token Storage:**
   - ✅ Use `.env` file (not in repo)
   - ✅ Use secrets manager in production (AWS Secrets, Azure Key Vault)
   - ❌ Never hardcode in source

2. **Access Control:**
   - Use read-only Figma tokens (if available)
   - Rotate tokens periodically
   - Limit token to specific files (team/project level)

3. **Rate Limits:**
   - Figma API: 1000 requests/hour/token
   - Cache Figma content if possible
   - Add delays between bulk operations

---

## Troubleshooting

### Error: "FIGMA_ACCESS_TOKEN environment variable is required"
- ✅ Check `.env` file exists in project root
- ✅ Restart the API server after adding token
- ✅ Verify token starts with `figd_`

### Error: "Figma API error: 403 Forbidden"
- ❌ Token is invalid or expired
- ❌ File is private and token doesn't have access
- ✅ Regenerate token or request file access

### Error: "Node {id} not found in Figma response"
- ❌ Node ID is wrong (check format: `1:23` not `1-23`)
- ❌ Node was deleted from Figma
- ✅ Verify node exists by checking Figma URL

### Screenshots are blank/broken
- ❌ Figma content has no text (only images/vectors)
- ✅ Use URL-based comparison for image-heavy designs
- ✅ Wait for roadmap feature: image download support

---

## Next Steps

- See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for upcoming Figma features
- Explore the Design System Analyzer for token validation
- Set up CI/CD integration (see Phase 4 in roadmap)

---

**Questions?** Open an issue on GitHub or check the main README.md
