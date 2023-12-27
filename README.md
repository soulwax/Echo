# Echo

Echo is a self-hosted, no-nonsense Discord music bot that offers a streamlined and efficient user experience. Designed for Discord, it integrates seamlessly with popular music services like YouTube and Spotify, providing a rich set of features for music playback.

## Features

- **Music Playback**: Play music from various sources including YouTube and Spotify.
- **Queue Management**: Easily manage the playback queue with commands to play, pause, skip, and stop.
- **Favorites**: Save your favorite tracks for quick access.
- **Advanced Controls**: Control playback with commands like seek, loop, and shuffle.

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

## Commands

Echo supports a variety of commands for music playback and bot control. Here are some key commands:

- `play`: Play a song from YouTube or Spotify.
- `queue`: View the current music queue.
- `skip`: Skip the currently playing song.
- `pause`: Pause playback.
- `resume`: Resume playback.
- `stop`: Stop playback and clear the queue.

For a full list of commands, refer to the [Commands](https://github.com/soulwax/Echo/blob/main/src/commands) directory.

## Contributing

Contributions to Echo are welcome! Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

Echo is licensed under the LGPL-3.0-or-later. See the [LICENSE](LICENSE) file for more details.
