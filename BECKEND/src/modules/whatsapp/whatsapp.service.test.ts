jest.mock('whatsapp-web.js', () => ({
  Client: jest.fn(),
  LocalAuth: jest.fn(),
  MessageMedia: { fromFilePath: jest.fn() },
}));

jest.mock('qrcode-terminal', () => ({ generate: jest.fn() }));

const ORIGINAL_ENV = { ...process.env };

function loadService(): any {
  let mod: any;
  jest.isolateModules(() => {
    mod = require('./whatsapp.service').default;
  });
  return mod;
}

describe('WhatsAppService — GROUP_ID_FALLBACK', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, WHATSAPP_ENABLED: 'true' };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('groupId is empty and a warning is logged when WHATSAPP_GROUP_ID_FALLBACK is not set', () => {
    delete process.env.WHATSAPP_GROUP_ID_FALLBACK;
    const service = loadService();

    expect(service.groupId).toBe('');
  });

  it('groupId is seeded from WHATSAPP_GROUP_ID_FALLBACK when configured', () => {
    process.env.WHATSAPP_GROUP_ID_FALLBACK = '120363425517091266@g.us';
    const service = loadService();

    expect(service.groupId).toBe('120363425517091266@g.us');
  });

  describe('findGroup()', () => {
    it('uses WHATSAPP_GROUP_ID_FALLBACK when no group matches by name', async () => {
      process.env.WHATSAPP_GROUP_NAME = 'Placas Disponíveis';
      process.env.WHATSAPP_GROUP_ID_FALLBACK = 'fallback-id@g.us';
      const service = loadService();

      service.client = {
        getChats: jest.fn().mockResolvedValue([
          { isGroup: true, name: 'Outro Grupo', id: { _serialized: 'other-id@g.us' } },
        ]),
      };

      await service.findGroup();

      expect(service.groupId).toBe('fallback-id@g.us');
    });

    it('disables group sending (empty groupId) when no match and no fallback configured', async () => {
      process.env.WHATSAPP_GROUP_NAME = 'Placas Disponíveis';
      delete process.env.WHATSAPP_GROUP_ID_FALLBACK;
      const service = loadService();

      service.client = {
        getChats: jest.fn().mockResolvedValue([
          { isGroup: true, name: 'Outro Grupo', id: { _serialized: 'other-id@g.us' } },
        ]),
      };

      await expect(service.findGroup()).resolves.toBeUndefined();

      expect(service.groupId).toBe('');
    });

    it('finds the group by name even without a fallback configured', async () => {
      process.env.WHATSAPP_GROUP_NAME = 'Placas Disponíveis';
      delete process.env.WHATSAPP_GROUP_ID_FALLBACK;
      const service = loadService();

      service.client = {
        getChats: jest.fn().mockResolvedValue([
          { isGroup: true, name: 'Placas Disponíveis - Equipe', id: { _serialized: 'found-id@g.us' } },
        ]),
      };

      await service.findGroup();

      expect(service.groupId).toBe('found-id@g.us');
    });

    it('falls back to WHATSAPP_GROUP_ID_FALLBACK on error without throwing', async () => {
      process.env.WHATSAPP_GROUP_ID_FALLBACK = 'fallback-id@g.us';
      const service = loadService();

      service.client = {
        getChats: jest.fn().mockRejectedValue(new Error('boom')),
      };

      await expect(service.findGroup()).resolves.toBeUndefined();
      expect(service.groupId).toBe('fallback-id@g.us');
    });

    it('does not throw on error when no fallback is configured (does not break bootstrap)', async () => {
      delete process.env.WHATSAPP_GROUP_ID_FALLBACK;
      const service = loadService();

      service.client = {
        getChats: jest.fn().mockRejectedValue(new Error('boom')),
      };

      await expect(service.findGroup()).resolves.toBeUndefined();
      expect(service.groupId).toBe('');
    });
  });
});
