using System.Net;
using System.Text.Json;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class InternationalCollectionTests
{
    private sealed class FeedHandler(bool fail = false) : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls;
        public Uri? LastUri;
        public HttpClient CreateClient(string name) => new(this, false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; LastUri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(fail ? HttpStatusCode.Forbidden : HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new { jobs = new[] {
                    new { id = 1, title = "Junior React Developer", company_name = "Example", description = "Required: React, TypeScript. Remote worldwide.", url = "https://remotive.com/job/1", candidate_required_location = "Worldwide" },
                    new { id = 2, title = "Junior QA Automation", company_name = "Example", description = "Required: C#, SQL, Testing. Remote worldwide.", url = "https://remotive.com/job/2", candidate_required_location = "Worldwide" },
                    new { id = 3, title = "Senior .NET Developer", company_name = "Example", description = "C#, SQL.", url = "https://remotive.com/job/3", candidate_required_location = "Worldwide" },
                    new { id = 4, title = "Sales representative", company_name = "Example", description = "Sell software.", url = "https://remotive.com/job/4", candidate_required_location = "Worldwide" }
                } }))
            });
        }
    }
    [TestMethod]
    public async Task SharedFeedIncludesComplementaryTechnicalRolesAndAvoidsRepeatedRequests()
    {
        var handler = new FeedHandler(); var client = new RemotiveClient(handler, Options.Create(new RemotiveOptions { Enabled = true, ApiUrl = "https://feed.invalid/jobs" }));
        var jobs = await client.GetSoftwareJobsAsync(default);
        CollectionAssert.AreEqual(new[] { "Junior React Developer", "Junior QA Automation" }, jobs.Where(JobService.MatchesTechnicalSearch).Select(v => v.Title).ToArray());
        Assert.AreEqual("", handler.LastUri!.Query, "Use one full feed instead of repeated category calls.");
        await client.GetSoftwareJobsAsync(default); Assert.AreEqual(1, handler.Calls);
        Assert.IsTrue(jobs.All(v => v.Source == "remotive" && v.Remote));
    }
    [TestMethod]
    public async Task FailedFeedIsReportedAndBackedOffRatherThanPretendingThereAreNoJobs()
    {
        var handler = new FeedHandler(true); var client = new RemotiveClient(handler, Options.Create(new RemotiveOptions { Enabled = true, ApiUrl = "https://feed.invalid/jobs" }));
        for (var i = 0; i < 2; i++)
        {
            try { await client.GetSoftwareJobsAsync(default); Assert.Fail("HTTP failure must be observable."); }
            catch (HttpRequestException) { }
        }
        Assert.AreEqual(1, handler.Calls, "Do not repeatedly hit a blocked feed.");
    }
}
