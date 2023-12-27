<p align="center">
  <img src="https://images-ext-1.discordapp.net/external/9fBpStwTU0ikNqtsmlZv_BB8PLnv9bOe28vnfmYGuH0/%3Fsize%3D2048/https/cdn.discordapp.com/avatars/1165196820117458954/672d50c24ec7998d00e03ee25ec1f93f.webp?format=webp&width=747&height=747" alt="Echo Bot" width="400"/>
</p>

# Echo

Echo is a self-hosted no bs discord bot for music playback. It supports youtube and spotify playback *in channel* and has a queue system. It also supports saving favorites and, if you have a **legal** download backend, you can /download embed songs from purely a query.

## Features

- **Music Playback**: Play music from various sources including YouTube and Spotify.
- **Queue Management**: Easily manage the playback queue with commands to play, pause, skip, and stop.
- **Favorites**: Save your favorite tracks for quick access.
- **Advanced Controls**: Control playback with commands like seek, loop, and shuffle.
- **Docker Support**: Easily deploy and run Echo in Docker containers for consistent and isolated environments.

## Getting Started

### Prerequisites

- Node.js (version >= 18.0.0)
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
   npm install
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

For a full list of commands, refer to the [Commands](https://github.com/soulwax/Echo/blob/main/src/commands) directory.

## Contributing

Contributions to Echo are welcome! Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

Echo is licensed under the LGPL-3.0-or-later. See the [LICENSE](LICENSE) file for more details.
