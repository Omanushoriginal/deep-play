# DEEP PLAY

A no-options football trivia game built as a static website. It uses a curated pool of tournament trivia and iconic football moments; match-result archive questions are not included. Each 15-question round includes three iconic-moment questions. Answers are typed; accepted accents and common short name variants are normalized automatically. Play solo, or play a live, share-code group match with up to eight players.

## Run locally

Serve the folder over HTTP (for example, in PowerShell run `py -m http.server 8000` from the project folder, then open `http://localhost:8000`). Multiplayer uses Firebase Authentication and Cloud Firestore, so configure Firebase once before creating/joining rooms.

## Enable online multiplayer

1. Create a project in the [Firebase Console](https://console.firebase.google.com/) and register a **Web app** in Project settings.
2. Copy the web app's `apiKey`, `authDomain`, `projectId`, and `appId` into `firebase-config.js`.
3. In **Authentication → Sign-in method**, enable **Anonymous** sign-in. In **Authentication → Settings → Authorized domains**, add your GitHub Pages host, such as `your-name.github.io`.
4. Create a **Cloud Firestore** database.
5. Open the Firestore **Rules** tab, paste in the contents of `firestore.rules`, and publish.
6. Commit and push the Firebase config and rules with the site. Open the deployed page; one player creates a room and shares the five-character code for 1–7 friends to join. The host can start once at least two players are present; rooms allow up to eight.

The Firebase web config is meant to be included in a browser app. Restrict its API key to your site's domain in Google Cloud API key settings. The included rules require anonymous authentication, limit rooms to eight players, and limit player documents to their owner. This is a casual trivia game: question data and scoring run in the browser, so it is not designed for prize play or cheat-proof competition. Rooms are not automatically expired; the room creator can remove an old room from Firestore if desired.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the branch you pushed and the `/(root)` folder, then save.

The site is served directly from the repository root. The supplied workflow at `.github/workflows/pages.yml` also supports GitHub's artifact-based Pages deployment if preferred.

## Add questions

Edit the `bank` array in `app.js` for tournament trivia, or `iconic-moments.js` for curated moment questions. Each entry has a `cat`, `q`, accepted `a` strings, and a short explanatory `fact`. Each round draws 15 questions, including three iconic moments.

## Sources

The quiz is an unofficial fan project. Iconic-moment questions reference official [FIFA World Cup archives](https://www.fifa.com/en/tournaments/mens/worldcup) and [UEFA competition archives](https://www.uefa.com/uefachampionsleague/history/).
