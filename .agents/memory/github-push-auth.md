---
name: GitHub push authentication
description: Environment-specific distinction between Git transport credentials and the connected GitHub API.
---

A working GitHub connection does not necessarily authenticate command-line Git pushes in this workspace. If Git transport rejects its credentials, the connected GitHub API may still have repository write access. Preserve the exact local commit identity when publishing through the API; Git commit messages can have a significant final newline.

**Why:** Git transport authentication failed even though the connected GitHub API could read and write the same repository. A reconstructed commit without the local message's final newline produced a different SHA.

**How to apply:** Prefer a normal Git push when available. If API publishing is required, verify the remote parent and resulting tree and commit IDs against local Git, update the branch without forcing, and verify the remote reference afterward.

Large single-line shell output from Git blob encoding can be cut short even when the shell callback does not report truncation. Check the expected byte length before using that output to recreate a Git object.

**Why:** A blob reconstructed from shortened output received a different SHA despite a successful API response.

**How to apply:** When publishing large blobs through the GitHub API, use bounded chunks or a text-file read, then require the API's blob SHA to match the local SHA before creating a tree.