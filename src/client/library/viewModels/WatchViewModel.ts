import * as app from '..';
import * as mobx from 'mobx';
const api = app.shared.core.api;

class NavigatorEpisode implements app.session.INavigatorEpisode {
  private readonly series: app.api.LibrarySeries;
  private readonly season: app.api.LibrarySeriesSeason;
  private readonly episode: app.api.LibrarySeriesSeasonEpisode;

  constructor(series: app.api.LibrarySeries, season: app.api.LibrarySeriesSeason, episode: app.api.LibrarySeriesSeasonEpisode) {
    mobx.makeObservable(this);
    this.series = series;
    this.season = season;
    this.episode = episode;
  }

  @mobx.computed
  get id() {
    return this.episode.id;
  }

  @mobx.computed
  get seriesName() {
    return this.series.title;
  }

  @mobx.computed
  get seasonName() {
    return this.season.title;
  }

  @mobx.computed
  get episodeName() {
    return this.episode.episode.toString();
  }

  @mobx.computed
  get episodeTitle() {
    return this.episode.title;
  }
}

class Navigator implements app.session.INavigator {
  private readonly series: app.api.LibrarySeries;
  private readonly episodeId: string;

  constructor(series: app.api.LibrarySeries, episodeId: string) {
    mobx.makeObservable(this);
    this.series = series;
    this.episodeId = episodeId;
  }

  @mobx.computed
  get current() {
    return this.episodes[this.currentIndex];
  }

  @mobx.computed
  get currentIndex() {
    return this.episodes.findIndex(x => x.id === this.episodeId);
  }

  @mobx.computed
  get episodes() {
    return this.series.seasons
      .map(x => x.episodes.map(y => new NavigatorEpisode(this.series, x, y)))
      .flatMap(x => x);
  }

  @mobx.computed
  get hasNext() {
    return this.currentIndex < this.episodes.length - 1;  
  }

  @mobx.computed
  get hasPrevious() {
    return this.currentIndex > 0;
  }

  @mobx.action
  openNext() {
    if (!this.hasNext) return;
    const episodeId = this.episodes[this.currentIndex + 1].id;
    const url = new URL(`../${episodeId}/`, location.href);
    app.shared.core.browser.replace(url.pathname);
  }

  @mobx.action
  openPrevious() {
    if (!this.hasPrevious) return;
    const episodeId = this.episodes[this.currentIndex - 1].id;
    const url = new URL(`../${episodeId}/`, location.href);
    app.shared.core.browser.replace(url.pathname);
  }

  @mobx.action
  preloadNext() {
    return;
  }
}

export class WatchViewModel {  
  constructor() {
    mobx.makeObservable(this);
  }

  @mobx.action
  async loadAsync(seriesId: string, episodeId: string) {
    const seriesPromise = api.library.seriesAsync({seriesId});
    const subtitlePromise = fetch(api.library.episodeSubtitleUrl({seriesId, episodeId}));
    const series = await seriesPromise;
    const subtitle = await subtitlePromise;
    if (series.value && subtitle.status === 200) {
      const navigator = new Navigator(series.value, episodeId);
      const url = api.library.episodeUrl({seriesId, episodeId});

      this.onDestroy();
      
      this.session = new app.session.MainViewModel(navigator);
      this.subtitles = [];
      await subtitle.blob().then(x => extractSubtitlesAsync(x, this.subtitles));

      setTimeout(() => {
        // LOL
        this.session!.bridge.dispatchRequest({type: 'loadSource', source: {url}});
        this.session!.bridge.dispatchRequest({type: 'subtitles', subtitles: this.subtitles});
      }, 250);

    } else if (series.statusCode === 404) {
      // Handle not found.
    } else {
      // Handle error.
    }
  }

  onDestroy() {

  }

  // TODO: release subtitles.

  @mobx.observable
  session?: app.session.MainViewModel = undefined;

  @mobx.observable
  subtitles = new Array<app.session.ISubtitle>();
}

import JSZip from 'jszip';
async function extractSubtitlesAsync(zip: Blob, subtitles: Array<app.session.ISubtitle>) {
  for (const file of await JSZip.loadAsync(zip).then(x => Object.values(x.files))) {
    const match = file.name.match(/\.(.+)\.(ass|srt)$/);
    if (match) {
      const language = match[1];
      const text = await file.async('text');
      const type = match[2] as 'ass' | 'srt';
      if (type === 'srt') {
        const value = text.replace(/(\d+:\d+:\d+)+,(\d+)/g, "$1.$2");
        const vtt = `WEBVTT\r\n\r\n${value}`;
        const url = URL.createObjectURL(new Blob([vtt]));
        subtitles.push({language, type: 'vtt', url});
      } else {
        const url = URL.createObjectURL(new Blob([text]));
        subtitles.push({language, type, url});
      }
    }
  }
}
