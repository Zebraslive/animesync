import * as app from '..';
import * as ncm from '@nestjs/common';

@ncm.Injectable()
export class ComposeService {
  private readonly agentService: app.AgentService;
  private readonly rewriteService: app.RewriteService;

  constructor(agentService: app.AgentService, rewriteService: app.RewriteService) {
    this.agentService = agentService;
    this.rewriteService = rewriteService;
  }

  series(compose: app.IComposable<app.api.RemoteSeries>) {
    return new app.api.RemoteSeries(compose.value, {
      imageUrl: compose.value.imageUrl && this.rewriteService.emulateUrl(compose.baseUrl, compose.value.imageUrl, compose.headers),
      seasons: compose.value.seasons.map(season => new app.api.RemoteSeriesSeason(season, {
        episodes: season.episodes.map(episode => new app.api.RemoteSeriesSeasonEpisode(episode, {
          imageUrl: episode.imageUrl && this.rewriteService.emulateUrl(compose.baseUrl, episode.imageUrl, compose.headers)
        }))
      }))
    });
  }

  async streamAsync(compose: app.IComposable<app.api.RemoteStream>) {
    return new app.api.RemoteStream(compose.value, {
      sources: await Promise.all(compose.value.sources.map(x => this.sourceAsync(x.url, compose.headers)))
        .then(x => x.flatMap(y => y))
        .then(x => x.sort(app.api.RemoteStreamSource.compareFn)),
      subtitles: compose.value.subtitles.map(subtitle => new app.api.RemoteStreamSubtitle(subtitle, {
        url: this.rewriteService.subtitleUrl(compose.baseUrl, subtitle.type, subtitle.url, compose.headers)
      }))
    });
  }

  private async sourceAsync(sourceUrl: string, headers?: Record<string, string>) {
    const streams = await this.agentService
      .fetchAsync(sourceUrl, {headers})
      .then(x => app.HlsManifest.from(x.toString()))
      .then(x => x.fetchStreams());
    return streams.map(x => new app.api.RemoteStreamSource({
      bandwidth: x.bandwidth || undefined,
      resolutionX: x.resolution.x || undefined,
      resolutionY: x.resolution.y || undefined,
      type: 'hls',
      url: this.rewriteService.hlsMasterUrl(sourceUrl, x.url, headers)
    }));
  }
}
