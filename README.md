<p align="center">
    <img src="https://images-ext-1.discordapp.net/external/9fBpStwTU0ikNqtsmlZv_BB8PLnv9bOe28vnfmYGuH0/%3Fsize%3D2048/https/cdn.discordapp.com/avatars/1165196820117458954/672d50c24ec7998d00e03ee25ec1f93f.webp?format=webp&width=747&height=747" alt="Echo Bot" width="400"/>
      <h3 align="center">ECHO</h3>
    <br />
     <p align="center">
      <a href="https://github.com/soulwax/ECHO/issues">Report Bug</a>
        <br />
      <a href="https://github.com/soulwax/ECHO/issues">Request Feature</a>
      <br />
      Made with ❤️ by <a href="https://github.com/soulwax">soul</a>
      </p>
  </p>

Echo is a self-hosted no bs discord bot for music playback. It supports youtube **AND** spotify playback *in channel* and has a queue system. It also supports saving favorites, setting the volume by command, and many more music related (and even video) features and, if you have a **legal** download backend, you can /download embed songs from purely a query.

## Features

- **Music Playback**: Play music from various sources including YouTube and Spotify.
- **Queue Management**: Easily manage the playback queue with commands to play, pause, skip, and stop.
- **Favorites**: Save your favorite tracks for quick access.
- **Advanced Controls**: Control playback with commands like seek, loop, and shuffle.
- **Docker Support**: Easily deploy and run Echo in Docker containers for consistent and isolated environments.
- **Download**: Download songs from an endpoint you provide at your own risk.
- **Youtube**: Pull youtube videos with a command.
- **Volume**: Set the volume of the bot with a command.

## Coming Soon
- **Spotify**: Play spotify playlists and albums with a command.
- **Search**: Search for songs on youtube with a command.
- **Video**: Play videos from youtube with a command.
- **Playlist**: Play playlists from youtube with a command.

## Getting Started

### Prerequisites

- Node.js (version >= 18.0.0)
- Yarn (for package management)
- pm2 (for process management)

Optional:
- Docker (for containerized deployment)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/soulwax/Echo.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Echo
   ```

3. Install dependencies:

   ```bash
   yarn
   ```

4. Build the project:

   ```bash
    yarn build
    ```
  
5. Create a `.env` file in the project root and set the following environment variables (see `.env.example` for reference):

   ```bash
   BOT_TOKEN=your_bot_token
   YOUTUBE_API_KEY=your_youtube_api_key
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ...
   ```

6. Start the bot via pm2:

   ```bash
   yarn start
   ```

### Configuration

1. Set up your `.env` file based on the provided `.env.example`.
2. Configure the bot token and music service API keys.

### Running the Bot

- To run the bot directly:

  ```bash
  npm start
  ```

- To run using Docker:

  ```bash
  docker-compose up
  ```

This will start the Echo bot in a Docker container with the specified configurations.

## Commands (not all of them)

Echo supports a variety of commands for music playback and bot control. Here are some key commands:

- `play`: Play a song from YouTube or Spotify.
- `queue`: View the current music queue.
- `skip`: Skip the currently playing song.
- `pause`: Pause playback.
- `resume`: Resume playback.
- `stop`: Stop playback and clear the queue.
- `download`: Download a song from an endpoint *you* provide at your own risk.
- `youtube`: Pull a youtube video with a command.
- `volume`: Set the volume of the bot.

For a full list of commands, refer to the [Commands](https://github.com/soulwax/Echo/blob/main/src/commands) directory.

## Contributing

Contributions to Echo are welcome! Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

Echo is licensed under the LGPL-3.0-or-later. See the [LICENSE](LICENSE) file for more details.
