// File: src/commands/download.ts

import { SlashCommandBuilder } from '@discordjs/builders';
import axios from 'axios';
import { exec } from 'child_process';
import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import fs from 'fs';
import https from 'https';
import { inject, injectable } from 'inversify';
import path from 'path';
import Config from '../services/config.js';
import { TYPES } from '../types.js';
import Command from './index.js';

const outputDir = path.join('./songs/');

@injectable()
export default class DownloadCommand implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('download')
    .setDescription('Download a song from a given query')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('The search query for the song')
        .setRequired(true),
    )
    .addIntegerOption(option =>
      option.setName('offset').setDescription('Song offset').setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('kbps')
        .setDescription('The bitrate of the song')
        .setRequired(false)
        .addChoices(
          { name: '128', value: '128' },
          { name: '320', value: '320' },
        ),
    );

  private readonly config: Config;

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config;
  }

  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query')!;
    const offset = interaction.options.getInteger('offset') ?? 0;
    const songQuery = query.replace(/ /g, '+');
    const kbpsQuery = interaction.options.getString('kbps') ?? '320';
    const url = `${this.config.DOWNLOAD_URL}${songQuery}&key=${this.config.DOWNLOAD_KEY}&offset=${offset}&kbps=${kbpsQuery}`;
    console.log(`Downloading song from ${url}`);
    await interaction.deferReply();

    try {
      const { filePath, filename } = await this.downloadFile(url, query);
      const fileAttachment = new AttachmentBuilder(filePath, {
        name: filename,
      });
      await interaction.editReply({
        content: 'Download completed.',
        files: [fileAttachment],
      });
      fs.unlinkSync(filePath); // Clean up the file after sending
    } catch (error) {
      console.error('Error occurred:', error);
      await interaction.editReply(
        'Failed to find results with the original backend, fallback to youtube...',
      );

      // Check if yt-dlp is installed before trying to use it
      this.checkYtDlpInstalled().then(async isInstalled => {
        if (isInstalled) {
          try {
            const ytFilePath = await this.downloadFromYouTube(query);
            const ytFileAttachment = new AttachmentBuilder(ytFilePath);
            await interaction.editReply({
              content: 'Falling back to youtube...download completed.',
              files: [ytFileAttachment],
            });
            fs.unlinkSync(ytFilePath); // Clean up the file after sending
          } catch (ytError) {
            console.error('YouTube download error:', ytError);
            await interaction.editReply(
              'Fallback to youtube, but... Error occurred while downloading from YouTube.',
            );
          }
        } else {
          await interaction.editReply(
            'yt-dlp is not installed. Unable to download from YouTube.',
          );
        }
      });
    }
  }

  private async downloadFromYouTube(query: string): Promise<string> {
    const ytSearchQuery = `ytsearch1:${query}`;
    const filename = `${query.replace(/ /g, '_')}.mp3`;
    const ytFilePath = path.join(outputDir, filename);

    return new Promise((resolve, reject) => {
      exec(
        `yt-dlp -x --audio-format mp3 -o "${ytFilePath}" "${ytSearchQuery}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error('Error downloading from YouTube:', stderr);
            reject(error);
          } else {
            console.log('YouTube Download stdout:', stdout);
            resolve(ytFilePath);
          }
        },
      );
    });
  }

  private async checkYtDlpInstalled(): Promise<boolean> {
    return new Promise(resolve => {
      exec('yt-dlp --version', error => {
        resolve(!error);
      });
    });
  }

  private async downloadFile(
    url: string,
    query: string,
  ): Promise<{ filePath: string; filename: string }> {
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    console.log('Response headers:');
    console.log(response.headers);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    let filename = `${query.replace(/ /g, '_')}.mp3`;

    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const match = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (match) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    // Filter out special characters and ensure .mp3 extension
    filename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '')
      .replace(/\.mp3+$/, '.mp3');
    if (!filename.endsWith('.mp3')) {
      filename += '.mp3';
    }

    const filePath = path.join(outputDir, filename);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve({
          filePath,
          filename,
        });
      });
      writer.on('error', reject);
    });
  }
}
