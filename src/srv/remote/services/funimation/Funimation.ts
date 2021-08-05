import * as app from '../..';
import * as fun from './typings';
import * as ncm from '@nestjs/common';
import {evaluateStreamAsync} from './evaluators/stream';
import {FunimationCredential} from './FunimationCredential';
import {FunimationRemap} from './FunimationRemap';
import playwright from 'playwright-core';
const baseUrl = 'https://www.funimation.com';

@ncm.Injectable()
export class Funimation implements app.IProvider {
  private readonly agentService: app.AgentService;
  private readonly browserService: app.BrowserService;

  constructor(agentService: app.AgentService, browserService: app.BrowserService) {
    this.agentService = agentService;
    this.browserService = browserService;
  }

  isSeriesAsync(seriesUrl: string) {
    const isSeries = /^https:\/\/www\.funimation\.com\/shows\/[^\/]+\/$/.test(seriesUrl);
    return Promise.resolve(isSeries);
  }

  isStreamAsync(streamUrl: string) {
    const isStream = /^https:\/\/www\.funimation\.com\/[^\/]{2}\/shows\/[^\/]+\/[^\/]+\/$/.test(streamUrl);
    return Promise.resolve(isStream);
  }

  async seriesAsync(seriesUrl: string) {
    return await this.browserService.pageAsync(async (page, userAgent) => {
      const [episodesPromise, seriesPromise] = new app.Observer(page).getAsync(/\/seasons\/[^\/]+$/, /\/shows\/[^\/]+$/);
      await page.goto(seriesUrl, {waitUntil: 'domcontentloaded'});
      await FunimationCredential.tryAsync(baseUrl, page, seriesUrl);
      const seasonEpisodes: Array<fun.Season> = [];
      const locale = await seriesPromise.then(x => x.request().url()).then(x => new URL(x).searchParams.get('locale'));
      const series = await seriesPromise.then(x => x.json() as Promise<fun.Series>);
      await this.fetchEpisodesAsync(episodesPromise, series, seasonEpisodes);
      const headers = Object.assign({'user-agent': userAgent}, defaultHeaders);
      const value = FunimationRemap.series(seriesUrl, series, seasonEpisodes, locale ?? undefined);
      return new app.Composable(seriesUrl, value, headers);
    });
  }

  async streamAsync(streamUrl: string) {
    return await this.browserService.pageAsync(async (page, userAgent) => {
      await page.goto(streamUrl, {waitUntil: 'domcontentloaded'});
      await FunimationCredential.tryAsync(baseUrl, page, streamUrl);
      const headers = Object.assign({'user-agent': userAgent}, defaultHeaders);
      const stream = await page.evaluate(evaluateStreamAsync);
      return new app.Composable(streamUrl, stream, headers);
    });
  }

  private async fetchEpisodesAsync(episodesPromise: Promise<playwright.Response>, series: fun.Series, seasonEpisodes: Array<fun.Season>) {
    const episodesResponse = await episodesPromise;
    const episodesRequest = episodesResponse.request();
    const episodesUrl = episodesRequest.url();
    for (const season of series.seasons) {
      const seasonUrl = episodesUrl.replace(/(\/seasons\/)[^\/\?]+/, (_, x) => x + season.id);
      if (episodesUrl !== seasonUrl) {
        const headers = Object.entries(episodesRequest.headers()).filter(([k]) => !k.startsWith(':'));
        const buffer = await this.agentService.fetchAsync(seasonUrl, {headers: {...headers, ...defaultHeaders}});
        seasonEpisodes.push(JSON.parse(buffer.toString('utf8')));
      } else {
        const episodes = await episodesResponse.json();
        seasonEpisodes.push(episodes as fun.Season);
      }
    }
  }
}

const defaultHeaders = {
  origin: 'https://www.funimation.com',
  referer: 'https://www.funimation.com/'
};
