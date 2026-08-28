using System.Security.Cryptography;
using System.Text;
using JobSearchAssistant.Domain;
using Microsoft.Extensions.Options;

namespace JobSearchAssistant.Services;

public sealed class SecretCipher
{
    private readonly byte[] _key;

    public SecretCipher(IOptions<SecurityOptions> options, ILogger<SecretCipher> logger)
    {
        var raw = options.Value.EncryptionKeyBase64;
        if (string.IsNullOrWhiteSpace(raw))
        {
            _key = RandomNumberGenerator.GetBytes(32);
            logger.LogWarning("Security:EncryptionKeyBase64 is not configured. Using an ephemeral key; OAuth tokens will not survive a restart. Configure a 32-byte Base64 key before connecting accounts.");
            return;
        }

        _key = Convert.FromBase64String(raw);
        if (_key.Length != 32)
            throw new InvalidOperationException("Security encryption key must decode to exactly 32 bytes.");
    }

    public string Protect(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return "";
        var nonce = RandomNumberGenerator.GetBytes(12);
        var tag = new byte[16];
        var input = Encoding.UTF8.GetBytes(plaintext);
        var output = new byte[input.Length];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, input, output, tag);
        var packed = new byte[nonce.Length + tag.Length + output.Length];
        Buffer.BlockCopy(nonce, 0, packed, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, packed, nonce.Length, tag.Length);
        Buffer.BlockCopy(output, 0, packed, nonce.Length + tag.Length, output.Length);
        return Convert.ToBase64String(packed);
    }

    public string Unprotect(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext)) return "";
        var packed = Convert.FromBase64String(ciphertext);
        var nonce = packed[..12];
        var tag = packed[12..28];
        var encrypted = packed[28..];
        var output = new byte[encrypted.Length];
        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(nonce, encrypted, tag, output);
        return Encoding.UTF8.GetString(output);
    }
}
