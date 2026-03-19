# Contribution Painter

Paint pixel art onto your GitHub contribution graph by generating backdated commits through a browser-based interface. Design on a 52-column by 7-row grid that mirrors GitHub's activity calendar, then push directly to any repository you own.

<img width="1405" height="580" alt="image" src="https://github.com/user-attachments/assets/377e6c96-2f62-4859-a514-36633a230dea" />


---

## How It Works

The tool renders a local replica of your GitHub contribution graph. Each cell corresponds to a specific calendar date. When you generate commits, the server backdates them using `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE`, writing them into a dedicated repository. GitHub then reads those commit timestamps and lights up the graph accordingly.

Intensity levels map to commit counts as follows:

| Level | Commits | Appearance |
|-------|---------|------------|
| 1     | 2       | Light green |
| 2     | 5       | Medium green |
| 3     | 10      | Dark green |
| 4     | 15      | Maximum green |


<img width="981" height="515" alt="image" src="https://github.com/user-attachments/assets/0a60be0d-3a83-4f2e-90fe-56830ac29e19" />

---

## Requirements

- [**Node.js**](https://nodejs.org) v14 or later
- [**Git**](https://git-scm.com/) installed and available in your PATH
- A GitHub account

---

## Setup

### 1. Create a dedicated repository

It is strongly recommended to create a **fresh, empty repository** on GitHub specifically for this purpose. Do not add .gitignore, or license when creating it -- the repository needs to be completely empty (README does not affect anything, it's fine to keep).

The reason for a dedicated repo is simple: the tool uses `git push --force` to overwrite history on every run. If the generated pattern does not look right, you can delete the repository entirely and start over without affecting any real work. Using an existing repository risks data loss.

### 2. Install dependencies

```bash
git clone https://github.com/lappisu/ContributionPainter/
cd src
npm install express moment
```

### 3. Start the server

```bash
node server.js
```

Open `http://localhost:3000` in your browser.

---

## Generating a GitHub Token

The tool authenticates with GitHub using a fine-grained personal access token. This token is used to clone your repository, push commits, and fetch your repo list -- it never leaves your machine (requests go directly from the local Node server to `api.github.com`).

### Creating the token

1. Go to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
2. Click **Generate new token**
3. Give it a descriptive name, for example `contribution-painter`
4. Set an expiration date that suits you
5. Under **Repository access**, select **Only select repositories** and choose the dedicated repository you created

### Required permissions

Under **Repository permissions**, set the following:

| Permission | Access |
|------------|--------|
| **Contents** | Read and write |
| **Metadata** | Read-only (auto-granted) |

Everything else can remain at **No access**. The Contents permission is what allows the tool to push commits. Metadata is required by GitHub for any fine-grained token and is granted automatically.

6. Click **Generate token** and copy it immediately -- GitHub will not show it again

Paste the token into the **Personal Access Token** field in the GitHub Integration panel of the painter, then click **Load Repos** to populate the repository dropdown.

<img width="864" height="470" alt="{0880C73E-7758-4655-9CBA-39ABF9834D2C}" src="https://github.com/user-attachments/assets/5fc15107-0891-46b6-8467-1d5108e54574" />

---

## Painting

**Left-click or drag** to paint cells. Hold and drag to paint multiple cells at once.

**Right-click** to erase a cell.

**Brush selector** controls the intensity level (1 through 4) applied when painting.

**Fill All** floods the entire canvas at the current brush intensity.

**Clear** resets the canvas.

### Text to art

Expand the **Text to Art** panel to render text directly onto the grid. Type up to approximately 8 characters, choose an alignment and intensity, then click **Apply to Grid**. The font is a 5x7 pixel bitmap that fits exactly within the 7-row height of the contribution graph. After applying, you can manually touch up individual cells before generating.

---

## Generating and Pushing

Once the canvas looks right, expand the **GitHub Integration** panel, select your repository and branch, and click **Push to GitHub**. The server will:

1. Clone the repository locally (or reuse an existing clone)
2. Generate backdated commits for every painted cell
3. Force-push the result to GitHub

The contribution graph on your profile updates within a few minutes, sometimes immediately.

If the result is not what you expected, delete the repository on GitHub, recreate it empty, delete the local `art-repo` folder inside the painter directory, and run again. The local `art-repo` folder is a working clone and can always be discarded safely.

---

## Notes

The grid covers the past 52 weeks starting from the Sunday of the week one year ago, which is exactly how GitHub calculates its contribution calendar. The server uses the same date calculation as the browser preview, so what you see in the painter is what gets pushed.

Each generate run overwrites the repository history with `--force`. This is intentional -- it means re-running with a corrected design replaces the old one cleanly rather than layering commits on top.

The file `pt.txt` is used as a placeholder that gets modified for each commit. Its contents are not meaningful.

---

## License

Free to use and modify. Credit appreciated but not required. Do not sell or paywall.
