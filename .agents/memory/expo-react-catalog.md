---
name: Expo React catalog alignment
description: Workspace dependency alignment during Expo SDK upgrades.
---

Keep the workspace React and React DOM catalog versions aligned with the Expo mobile artifact's SDK-required React version, even when the mobile app declares its own exact versions.

**Why:** An SDK upgrade changed React in the mobile package, but a shared workspace dependency still resolved its peer against the older catalog React. Expo Doctor reported duplicate native React installations until the catalog was aligned.

**How to apply:** After future Expo upgrades, run Expo Doctor and check its duplicate-native-dependency result; update the workspace catalog and lockfile together if peer resolution still retains the prior React version.