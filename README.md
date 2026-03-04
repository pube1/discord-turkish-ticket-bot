# discord-ticket-bot

<div align="center">
  <br />
    <img src="https://i.imgur.com/bvxcjXH.png" width="150" alt="Ticket Bot" />
  <br />
  <h1>🎫 Advanced Discord Ticket & Server Management Bot</h1>
  <p>
    A professional, fast, and fully optimized ticket and management bot powered by Discord.js v14.
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about">About</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#installation">Installation and Setup</a></li>
    <li><a href="#commands">Commands</a></li>
    <li><a href="#technologies">Technologies</a></li>
  </ol>
</details>

## 🚀 About

This project is specially developed to facilitate the management of a Discord server's technical support team, log all events, and track the instant game server status. It is written using **Discord.js v14** and the latest **Node.js** technologies. 

It features advanced engineering optimizations such as "ghost-ticket" protection, asynchronous transcript closing algorithm, and automatic RAM >> Disk caching system every 3 minutes.

## ✨ Features

* **Advanced Ticket System:** Button approvals, "Claim Ticket" button, and an advanced ticket management interface (Add/Remove/Transfer User).
* **HTML Transcripts:** When a ticket is closed, it sends the conversation history as a stylish web page `(.html)` to a dedicated log channel and the DM inbox of the user who opened the ticket.
* **Staff Leaderboard (Toplist):** Lists the staff members who solved the most tickets with a `rank` system in Daily, Weekly, and All-Time periods.
* **Dynamic Profile (Gamedig):** By querying the game server (caches every 60 seconds), it reflects the "Active Players (e.g., 30/128)", "Site Name", and "Slogan" changing every 10 seconds in the bot's "Playing" activity.
* **Security Logs:** Detects banned and kicked members along with their reasons and sends them to specific server log channels.
* **General Log System:** All user actions like joining/leaving the server, deleted messages, and joining/leaving voice channels are logged in detail in different channels.
* **Voice Channel Integration:** Administrators can make the bot join a specific voice channel using the `/voice` command (The bot stays active in the room 24/7).
* **Counter Management:** The number sequence in the titles of tickets to be opened (e.g., `ticket-0100`) can be managed from the panel.

## 💻 Installation

It is very easy to run the project 24/7 on your own computer or VDS servers.

### Requirements
- Node.js (v18.x or higher)
- Discord Bot Token and Client ID (Obtained from the Discord Developer Portal)
- `Message Content`, `Server Members`, and `Presence` intents must be enabled on the server.

### Installation Steps

1. Clone or download the repository to your computer/VDS.
2. Open a terminal (`cmd` or `powershell`) inside the folder.
3. Enter the following command to install the required libraries:
   ```bash
   npm install
   ```
4. Open the `.env` file in the folder with a text editor and enter your credentials and server configurations:
   ```env
   DISCORD_TOKEN=YourBotTokenHere
   DISCORD_CLIENT_ID=YourBotClientIdHere
   SERVER_IP=127.0.0.1
   SERVER_PORT=27015
   ```
   *(Replace the IP and Port with your actual game server details)*
5. Start the bot!
   ```bash
   node index.js
   ```

## 🛠️ Commands

The bot is entirely built on a modern `Slash (/)` command infrastructure.

### Administrator Commands 👑
* `/setup`: Sets up the support system and sends the button panel. *(Required settings: Panel Channel, Staff Role, Transcript Log Channel, Ticket Category)*
* `/log_setup`: Sets up the channels for Ban and Kick logs.
* `/general_log_setup`: Sets up Mod/General log channels *(Join-Leave, Message-Delete, Voice-Log)*.
* `/counter`: Sets the starting number for the next ticket to be opened.
* `/voice`: Sets the Discord voice channel the bot will join.
* `/active`: Announces that the game server is open with its IP address by tagging `@everyone`.
* `/maintenance`: Announces that the game server is under maintenance by tagging `@everyone`.

### Staff (Support) Commands 🛡️
* `/toplist`: Shows the staff's ranking for solving the most tickets *(Daily, Weekly, All Time)*.
* `/add <user>`: Adds the selected user to the ticket.
* `/remove <user>`: Removes the selected user's authorization from the ticket.
* `/transfer <staff>`: Transfers the current support ticket to another staff member.
* `/close`: Safely ends and deletes the ticket by generating an HTML transcript.

## ⚙️ Technologies
* **[Discord.js v14](https://discord.js.org/)** - Powerful API Wrapper
* **[Gamedig](https://www.npmjs.com/package/gamedig)** - Server Query Infrastructure
* **[Discord-html-transcripts](https://www.npmjs.com/package/discord-html-transcripts)** - Excellent transcript archive interface
* **[@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice)** - Smooth voice channel activation

<br />
<div align="center">
  <i>This project is designed to handle thousands of ticket requests simultaneously without any bottlenecks with its optimized asynchronous code structure. 🚀</i>
</div>
