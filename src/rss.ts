export type RssChannel = { title: string; description: string; url: string };
export type RssItem = { title: string; description: string; pubdate: string; url: string };

export function toRssXml(channel: RssChannel, items: RssItem[]): string {
    const escapeXml = (unsafe: string) => {
        return unsafe.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case "&":
                    return "&amp;";
                case "'":
                    return "&apos;";
                case '"':
                    return "&quot;";
                default:
                    return c;
            }
        });
    };

    const channelXml = `
      <channel>
        <title>${escapeXml(channel.title)}</title>
        <link>${escapeXml(channel.url)}</link>
        <description>${escapeXml(channel.description)}</description>
        ${items
            .map(
                (item) => `
          <item>
            <title>${escapeXml(item.title)}</title>
            <link>${escapeXml(item.url)}</link>
            <description>${escapeXml(item.description)}</description>
            <pubDate>${escapeXml(new Date(item.pubdate).toUTCString())}</pubDate>
          </item>
        `
            )
            .join("")}
      </channel>
    `;

    return `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    ${channelXml}
  </rss>`;
}
