# Stamps & Stories

My travel passport website. Everyone can browse it; only I can edit it.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole website |
| `shim.js` | Loads the trips for visitors and saves my edits to GitHub |
| `data.json` | My profile, stamps and the list of photos (edited by the site itself) |
| `images/` | Every photo I upload (added by the site itself) |

## Put it online with GitHub Pages (one time, about 10 minutes)

1. **Create the repository.** On github.com, click **+ → New repository**. Name it, for example, `stamps-and-stories`. Choose **Public** (GitHub Pages is free for public repos), then **Create repository**.
2. **Upload the files.** On the new repo page, click **uploading an existing file** (or **Add file → Upload files**). Drag in `index.html`, `shim.js`, `data.json`, `README.md` **and the `images` folder**, then click **Commit changes**.
3. **Turn on Pages.** Go to **Settings → Pages**. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, and click **Save**.
4. **Wait about a minute**, then refresh that Settings → Pages screen. It shows your address, like
   `https://YOUR-USERNAME.github.io/stamps-and-stories/`. That's the link to share.

## Turn on editing for me only (one time)

1. On GitHub, open your profile picture menu → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Give it a name like *Stamps & Stories editor* and an expiration you're comfortable with.
3. Under **Repository access**, pick **Only select repositories** and choose `stamps-and-stories`.
4. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**. Leave everything else as is.
5. Click **Generate token** and copy it (it starts with `github_pat_`).
6. Open your site with `?owner` at the end, for example
   `https://YOUR-USERNAME.github.io/stamps-and-stories/?owner`
7. Check the repository name is right, paste the token, and click **Sign in**.

You'll see an **Owner mode** badge in the corner and all the edit buttons. Do this once per browser or device you edit from. Tap **Sign out** on the badge to remove the token from that browser.

## How it works

- **Visitors** never see edit buttons, need no account, and can't change anything.
- **When I edit**, each change is saved straight into this repository as a commit. I see it right away; visitors see it after GitHub Pages republishes, usually within a minute.
- **Photos** are resized to at most 2400 px before uploading, so they stay small.

## Keep in mind

- Everything in this repository is **public**, including `data.json`. That file holds my profile details, including my **date of birth** (only my age shows on the site, but the full date is readable in the file). Leave the birth date empty in **Edit profile** if you'd rather not publish it.
- **Never share the token or commit it anywhere.** It lives only in my browser. If it leaks, delete it on GitHub (same Fine-grained tokens page) and make a new one.
- Opening `index.html` straight from my computer won't load the trips; view it through the GitHub Pages address.
