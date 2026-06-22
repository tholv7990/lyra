import { Provider } from '@lyra/shared';
import { RunsService } from './runs.service';

type ExecMap = Partial<Record<Provider, jest.Mock>>;

function makeSvc(execMap: ExecMap, keyedProviders: Provider[]) {
  const registry = { get: (p: Provider) => ({ execute: execMap[p] ?? jest.fn() }) };
  const keys = {
    list: jest.fn().mockResolvedValue(keyedProviders.map((provider) => ({ provider }))),
    getDecrypted: jest.fn().mockResolvedValue('alt-key'),
  };
  const svc = new RunsService(
    {} as never, keys as never, {} as never, registry as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { svc, keys };
}
const step = (p: Provider) => ({ provider: p, model: 'm', name: 'Hook' });
const call = (svc: RunsService, primary: Provider) =>
  (svc as unknown as { executeWithFallback: Function }).executeWithFallback(primary, step(primary), 'primary-key', [], [], 'ws');

describe('RunsService.executeWithFallback', () => {
  it('primary success → primary served, no key lookup, no alt call', async () => {
    const primaryExec = jest.fn().mockResolvedValue({ result: 'ok' });
    const { svc, keys } = makeSvc({ [Provider.OpenAI]: primaryExec }, []);
    const res = await call(svc, Provider.OpenAI);
    expect(res).toMatchObject({ servedBy: Provider.OpenAI, output: { result: 'ok' } });
    expect(keys.list).not.toHaveBeenCalled();
  });

  it('primary retryable (429) + alt keyed → alt serves with its default model', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 429 });
    const dsExec = jest.fn().mockResolvedValue({ result: 'from-deepseek' });
    const { svc } = makeSvc({ [Provider.OpenAI]: primaryExec, [Provider.DeepSeek]: dsExec }, [Provider.DeepSeek]);
    const res = await call(svc, Provider.OpenAI);
    expect(res.servedBy).toBe(Provider.DeepSeek);
    expect(res.output.result).toBe('from-deepseek');
    expect(dsExec.mock.calls[0][0].step.provider).toBe(Provider.DeepSeek);
    expect(dsExec.mock.calls[0][0].step.model).not.toBe('m');
  });

  it('primary retryable + no eligible alt → throws the primary error', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 429 });
    const { svc } = makeSvc({ [Provider.OpenAI]: primaryExec }, []);
    await expect(call(svc, Provider.OpenAI)).rejects.toMatchObject({ status: 429 });
  });

  it('primary non-retryable (400) → throws, no fallback attempted', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 400 });
    const anthroExec = jest.fn();
    const { svc, keys } = makeSvc({ [Provider.OpenAI]: primaryExec, [Provider.Anthropic]: anthroExec }, [Provider.Anthropic]);
    await expect(call(svc, Provider.OpenAI)).rejects.toMatchObject({ status: 400 });
    expect(anthroExec).not.toHaveBeenCalled();
    expect(keys.list).not.toHaveBeenCalled();
  });
});
