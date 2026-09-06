using JobSearchAssistant.Data;
using JobSearchAssistant.Domain;
using JobSearchAssistant.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace JobSearchAssistant.Tests;

[TestClass]
public sealed class ApplicationAttributionServiceTests
{
    [TestMethod]
    public async Task RecordsPdfForExistingExternalApplication()
    {
        await using var db = CreateDb();
        var vacancy = AppliedVacancy("jobs.lever.co", "external/manual");
        db.Add(vacancy);
        await db.SaveChangesAsync();

        var recorded = await new ApplicationAttributionService(db)
            .RecordExternalCvAsync(vacancy.Id, "Violetta_Nicolaou_CV_EN_v2.pdf", CancellationToken.None);

        Assert.IsTrue(recorded);
        var saved = await db.Vacancies.Include(x => x.Application).Include(x => x.Events).SingleAsync();
        Assert.AreEqual("external/Violetta_Nicolaou_CV_EN_v2.pdf", saved.Application!.ResumeExternalId);
        Assert.IsTrue(saved.Events.Any(x => x.Type == "CvAttributed"));
    }

    [TestMethod]
    public async Task DoesNotAttributeHhOrNonPdfValues()
    {
        await using var db = CreateDb();
        var hh = AppliedVacancy("hh", "resume-id");
        db.Add(hh);
        await db.SaveChangesAsync();

        var sut = new ApplicationAttributionService(db);
        Assert.IsFalse(await sut.RecordExternalCvAsync(hh.Id, "Violetta_Nicolaou_CV_RU_v2.pdf", CancellationToken.None));
        Assert.IsFalse(await sut.RecordExternalCvAsync(hh.Id, "resume.exe", CancellationToken.None));
        Assert.AreEqual("resume-id", (await db.Applications.SingleAsync()).ResumeExternalId);
    }

    [TestMethod]
    public void Sanitizer_RemovesPathAndRejectsWrongExtension()
    {
        Assert.AreEqual("Violetta CV EN.pdf", ApplicationAttributionService.SanitizeResumeLabel("C:\\Users\\V\\Violetta CV EN.pdf"));
        Assert.AreEqual("", ApplicationAttributionService.SanitizeResumeLabel("resume.docx"));
    }

    private static Vacancy AppliedVacancy(string source, string resume)
    {
        var company = new Company { Name = "Example", Source = "global", ExternalId = Guid.NewGuid().ToString("N") };
        var vacancy = new Vacancy
        {
            Company = company,
            CompanyId = company.Id,
            Source = source,
            SourceLabel = source == "hh" ? "HeadHunter" : "Lever",
            ExternalId = Guid.NewGuid().ToString("N"),
            CanonicalFingerprint = Guid.NewGuid().ToString("N"),
            Title = "Junior .NET Developer",
            Url = "https://example.com/job",
            Status = VacancyStatus.Applied,
            IsRemote = true
        };
        vacancy.Application = new Application
        {
            Vacancy = vacancy,
            VacancyId = vacancy.Id,
            ResumeExternalId = resume,
            AppliedAt = DateTimeOffset.UtcNow
        };
        return vacancy;
    }

    private static AppDbContext CreateDb()
        => new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"attribution-{Guid.NewGuid()}")
            .Options);
}
