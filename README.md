# electron-progress-bar

Simple progress tracker application written in Electron, React, and Tailwind for personal use. Only tested on Ubuntu.

So if you try to do OAuth with Google, they don't properly implement PKCE and still require you to have a secret. It is impossible to securely store a secret in an Electron app, and Google patched all the workarounds people found (but didn't fix their broken auth flow). So I'd have to host a tiny secure backend server and implement even more things so I won't hold the secret in my unsecure bundled app. Absolutely great stuff! Along with the fact that I can't leave 8 year old abandoned, dead projects I do not own in Google Cloud (that's a feature, not a bug!) I genuinely don't see why I would ever use this again.
