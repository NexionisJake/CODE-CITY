# github_ingestor.py — Downloads and extracts a GitHub repo zip into a temp directory.

import io
import re
import tempfile
import zipfile

import requests


def download_repo(repo_url: str) -> tempfile.TemporaryDirectory:
    """Download a GitHub repository as a zip and extract it to a temp directory.

    Args:
        repo_url: GitHub URL like https://github.com/owner/repo

    Returns:
        A TemporaryDirectory whose .name contains the extracted repo files.
        The caller is responsible for cleanup.

    Raises:
        ValueError: If the URL doesn't match the expected GitHub format.
        requests.HTTPError: If the download fails on both main and master branches.
    """
    match = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", repo_url)
    if not match:
        raise ValueError(
            f"Invalid GitHub URL: {repo_url!r}. "
            "Expected format: https://github.com/owner/repo"
        )

    owner, repo = match.group(1), match.group(2)

    # Try main branch first, then fall back to master
    for branch in ("main", "master"):
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
        resp = requests.get(zip_url, timeout=30)
        if resp.status_code == 404 and branch == "main":
            continue
        resp.raise_for_status()
        break

    tmp_dir = tempfile.TemporaryDirectory()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        zf.extractall(tmp_dir.name)

    return tmp_dir
