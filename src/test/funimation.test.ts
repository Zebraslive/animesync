import * as app from '../server';
const core = new app.api.SettingCore(app.settings.core);
const credential = new app.api.SettingCredential(app.settings.credential);

describe('Funimation', () => {
  beforeAll(() => app.Server.usingAsync(async (api) => {
    await api.setting.corePutAsync(new app.api.SettingCore(core, fetchCore()));
    await api.setting.credentialPutAsync(new app.api.SettingCredential(credential, fetchCredential()));
  }));

  it('Series', () => app.Server.usingAsync(async (api) => {
    const series = await api.remote.seriesAsync({url: 'https://www.funimation.com/shows/the-saints-magic-power-is-omnipotent/'});
    expect(series.error).toBeUndefined();
    expect(series.value?.imageUrl).not.toBeUndefined();
    expect(series.value?.seasons).not.toEqual([]);
    expect(series.value?.synopsis).not.toBeUndefined();
    expect(series.value?.title).toEqual('The Saint\'s Magic Power is Omnipotent');
    expect(series.value?.url).not.toBeUndefined();
    expect(series.value?.seasons[0].title).toEqual('Season 1');
    expect(series.value?.seasons[0].episodes[0].imageUrl).not.toBeUndefined();
    expect(series.value?.seasons[0].episodes[0].name).toEqual('1');
    expect(series.value?.seasons[0].episodes[0].synopsis).not.toBeUndefined();
    expect(series.value?.seasons[0].episodes[0].title).toEqual('Summoning');
    expect(series.value?.seasons[0].episodes[0].url).not.toBeUndefined();
  }));

  it('Stream', () => app.Server.usingAsync(async (api) => {
    const stream = await api.remote.streamAsync({url: 'https://www.funimation.com/en/shows/the-saints-magic-power-is-omnipotent/summoning/'});
    expect(stream.error).toBeUndefined();
    expect(stream.value?.sources).not.toEqual([]);
    expect(stream.value?.subtitles).not.toEqual([]);
  }));
  
  afterAll(() => app.Server.usingAsync(async (api) => {
    await api.setting.corePutAsync(core);
    await api.setting.credentialPutAsync(credential);
  }));
});

function fetchCore(): Partial<app.api.SettingCore> {
  const proxyServer = process.env.AST_FUNIMATION_PROXYSERVER;
  return {proxyServer};
}

function fetchCredential(): Partial<app.api.SettingCredential> {
  const funimationPassword = process.env.AST_FUNIMATION_PASSWORD;
  const funimationUsername = process.env.AST_FUNIMATION_USERNAME;
  return {funimationPassword, funimationUsername};
}
