import { SlashCommandBuilder } from '@discordjs/builders';
import ytsr from '@distube/ytsr';
import { exec } from 'child_process';
import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import path from 'path';
import { fileURLToPath } from 'url';
import Config from '../services/config.js';
import { DownloadResult, TYPES } from '../types.js';
import Command from './index.js';

const MAX_FILE_SIZE_MB_FOR_UNBOOSTED_SERVER = 8;
const MAX_FILE_SIZE_MB_FOR_BOOSTED_SERVER = 50;
// Convert the URL of the current module to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, 'videos');

@injectable()
export default class YoutubeDownloadCommand implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Download a video from a given query')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('The search query for the video')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('quality')
        .setDescription('The quality of the video')
        .setRequired(false)
        .addChoices(
          { name: 'Best', value: 'bestvideo+bestaudio/best' },
          { name: 'Normal', value: 'worstvideo+worstaudio/worst' },
        ),
    );

  private readonly config: Config;

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config;
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    this.checkYtDlpInstalled().then(installed => {
      if (!installed) {
        console.error(
          'yt-dlp is not installed. Please install it from a package or trustworthy source.',
        );
      }
    });
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query')!;
    const quality
      = interaction.options.getString('quality') || 'worstvideo+worstaudio/worst';

    await interaction.deferReply();

    try {
      const { videoUrl, filePath } = await this.downloadFileWithYtDlp(
        query,
        quality,
      );

      const qualityValue
        = quality === 'bestvideo+bestaudio/best'
          ? MAX_FILE_SIZE_MB_FOR_BOOSTED_SERVER
          : MAX_FILE_SIZE_MB_FOR_UNBOOSTED_SERVER;
      await this.compressVideo(filePath, qualityValue);

      if (this.isFileSizeAcceptable(filePath, qualityValue)) {
        const fileAttachment = new AttachmentBuilder(filePath);
        await interaction.editReply({
          content: 'Download completed.',
          files: [fileAttachment],
        });
      } else {
        await interaction.editReply({
          content: `The video file is too large for this Discord server. Here's the direct YouTube link: ${videoUrl}`,
        });
      }
    } catch (error) {
      console.error(error);
      const videoUrl = await this.getFallbackYoutubeLink(query);
      await interaction.editReply({
        content: `Server probably not fit for meaningful compression sizes. Here's a direct link instead: ${videoUrl}`,
      });
    }
  }

  private async checkYtDlpInstalled(): Promise<boolean> {
    return new Promise(resolve => {
      exec('yt-dlp --version', error => {
        resolve(!error);
      });
    });
  }

  private async downloadFileWithYtDlp(
    query: string,
    quality?: string,
  ): Promise<DownloadResult> {
    const ytDlpQuality = quality || 'bestvideo+bestaudio/best';
    const ytSearchQuery = `ytsearch1:${query}`; // Limit to 1 result

    // Sanitize query for filename
    const safeQuery = query
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 200);

    const ytFilePath = path.join(outputDir, safeQuery);
    const outputTemplate = `${ytFilePath}.%(ext)s`;

    return new Promise((resolve, reject) => {
      // First, get the video URL
      exec(
        `yt-dlp -f ${ytDlpQuality} --get-url "${ytSearchQuery}"`,
        (urlError, urlStdout, urlStderr) => {
          if (urlError) {
            console.error('Error getting video URL:', urlStderr);
            reject(new Error('Failed to get video URL.'));
            return;
          }

          const videoUrl = urlStdout.trim();

          // Then, download the video
          exec(
            `yt-dlp -f ${ytDlpQuality} -o "${outputTemplate}" "${videoUrl}"`,
            (downloadError, downloadStdout, downloadStderr) => {
              if (downloadError) {
                console.error('Error downloading video:', downloadStderr);
                reject(new Error('Failed to download video.'));
                return;
              }

              const mp4FilePath = `${ytFilePath}.mp4`;
              if (fs.existsSync(mp4FilePath)) {
                resolve({ filePath: mp4FilePath, videoUrl });
              } else {
                reject(new Error('Downloaded file not found.'));
              }
            }
          );
        }
      );
    });
  }

  private async compressVideo(
    filePath: string,
    targetSizeMB: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error getting video duration:', stderr);
            reject(new Error('Failed to get video duration.'));
            return;
          }

          const durationInSeconds = parseFloat(stdout);

          const scale = targetSizeMB > 25 ? 'iw/2:ih/2' : targetSizeMB < 12 ? 'iw/4:ih/4' : 'iw:ih';
          const compressedFilePath = filePath.replace('.mp4', '_compressed.mp4');
          const crfValue = targetSizeMB > 25 ? '23' : '28';
          const preset = 'slow';

          const ffmpegCommand = `ffmpeg -i "${filePath}" -c:v libx264 -preset ${preset} -crf ${crfValue} -c:a aac -b:a 128k -vf "scale=${scale}" -y "${compressedFilePath}"`;

          exec(ffmpegCommand, (ffmpegError, ffmpegStdout, ffmpegStderr) => {
            if (ffmpegError) {
              console.error('Error compressing video:', ffmpegStderr);
              reject(new Error('Video compression failed.'));
            } else {
              fs.unlinkSync(filePath);
              fs.renameSync(compressedFilePath, filePath);
              resolve();
            }
          });
        }
      );
    });
  }

  private isFileSizeAcceptable(filePath: string, maxSizeMB: number): boolean {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const maxSizeInBytes = maxSizeMB * 1024 * 1024;
    return fileSizeInBytes <= maxSizeInBytes;
  }

  private async getFallbackYoutubeLink(query: string): Promise<string> {
    try {
      const ytidFromQuery = await this.extractFirstYoutubeIdFromSearch(query);
      return `https://www.youtube.com/watch?v=${ytidFromQuery}`;
    } catch (e) {
      console.error('Error extracting YouTube ID:', e);
      return 'Error: Unable to retrieve YouTube link.';
    }
  }

  private async extractFirstYoutubeIdFromSearch(
    query: string,
  ): Promise<string> {
    const searchResults = await ytsr(query, { limit: 1 });
    if (!searchResults || !Array.isArray(searchResults.items) || searchResults.items.length === 0) {
      throw new Error('No video found.');
    }
    const firstResult = searchResults.items[0];
    if (firstResult.type !== 'video' || !firstResult.id) {
      throw new Error('No video found.');
    }
    return firstResult.id;
  }
}
