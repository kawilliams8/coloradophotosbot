# Colorado History Photos Bot

## Overview

Colorado History Photos is an automated bot that scrapes historical photos from the Denver Public Library digital archive, formats structured descriptions, and posts them to [Bluesky](https://bsky.app/profile/coloradophotos.bsky.social). The bot generates concise captions, appends relevant hashtags, and ensures accessibility via alt text.

## Purpose

This project aims to share historical images of Colorado in an engaging, structured format. By leveraging AI-generated text summarization and automation, the bot presents historical insights social media-friendly manner.

## Features

- **Web Scraping**: Extracts metadata, including titles, dates, and summaries, from the digital archive.
- **AI-Powered Text Composition**: Uses Claude 3.7 Sonnet to generate formatted captions with hashtags.
- **Automated Posting**: Publishes posts to Bluesky at scheduled intervals via GitHub Action.
- **Accessibility Support**: Uses alt text to improve usability for visually impaired users.
- **Error Handling & Logging**: Ensures reliable operation with robust error handling.

## Resources

- **Data Source**: [Denver Public Library Digital Archive](https://digital.denverlibrary.org/)
- **Claude AI API**: For text generation and summarization, hashtag creation
- **Bluesky API**: For image/text posting and rich text processing

## Tech Stack

- **TypeScript**: Strongly-typed JavaScript for reliability and maintainability
- **Node.js**: Runtime for executing the bot
- **Cheerio**: Lightweight library for web scraping
- **Axios**: HTTP client for fetching data
- **Anthropic Claude SDK**: AI-powered text generation
- **dotenv**: Manages environment variables securely

## Troubleshooting

**403 Forbidden when scraping**  
The Denver Public Library site may block requests from cloud/datacenter IPs (e.g. GitHub Actions). If the bot fails with 403, run it from a local machine or a network with a residential IP (e.g. `npm run start` on your computer or a self-hosted runner). You can also contact Denver Public Library to ask about programmatic access or IP whitelisting.

## Contributing

Contributions are welcome! Feel free to open issues and submit pull requests.
