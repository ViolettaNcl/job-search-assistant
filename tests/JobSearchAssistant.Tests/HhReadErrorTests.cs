using System.Net;
using JobSearchAssistant.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;
[TestClass]
public sealed class HhReadErrorTests
{
    [TestMethod]
    public void ClassifiesCaptchaWithoutExposingChallengeUrlOrPayload()
    {
        var r = HhReadException.FromResponse(HttpStatusCode.Forbidden, "{\"errors\":[{\"type\":\"captcha_required\",\"captcha_url\":\"private-value\"}]}");
        Assert.AreEqual("captcha_required", r.Code); Assert.IsFalse(r.Message.Contains("private-value"));
    }
    [TestMethod]
    public void ClassifiesExpiredAuthorizationInsteadOfGenericForbidden()
    {
        var r = HhReadException.FromResponse(HttpStatusCode.Forbidden, "{\"errors\":[{\"type\":\"oauth\",\"value\":\"token_expired\"}]}");
        Assert.AreEqual("oauth", r.Code); StringAssert.Contains(r.Message.ToLowerInvariant(), "авторизац");
    }
    [TestMethod]
    public void UnknownForbiddenDoesNotInventCauseOrExposeHtml()
    {
        var r = HhReadException.FromResponse(HttpStatusCode.Forbidden, "<html>private-proxy-token</html>");
        Assert.AreEqual("access_denied", r.Code); StringAssert.Contains(r.Message, "Причина не уточнена");
        Assert.IsFalse(r.Message.Contains("private-proxy-token"));
    }
    [TestMethod]
    public void RateLimitIsReportedAsAStop()
    {
        Assert.AreEqual("rate_limit", HhReadException.FromResponse(HttpStatusCode.TooManyRequests, "{}").Code);
    }
}
