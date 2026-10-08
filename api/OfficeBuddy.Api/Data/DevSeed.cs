using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;

namespace OfficeBuddy.Api.Data;

// Fictitious colleagues with workplace entries around today, so the views have something to show
// in Development. Runs at every dev startup and only adds what is missing. Never use outside dev.
public static class DevSeed
{
    private static readonly string[] Names =
    [
        "Anna Lindqvist", "Björn Åkesson", "Cecilia Holm", "David Öberg", "Elin Sjöström",
        "Fredrika Nyberg", "Gustav Ek", "Hanna Wikström", "Isak Lundgren", "Johanna Bergman",
        "Karl Sandberg", "Lina Östlund", "Mikael Forsberg", "Nora Hedlund",
    ];

    // Seeded people have ids 00000000-0000-0000-0000-0000000000NN, which no real `oid` has –
    // delete them with: DELETE FROM People WHERE Oid LIKE '00000000-0000-0000-0000-%'
    private static Guid OidFor(int index) => new($"00000000-0000-0000-0000-{index + 1:D12}");

    public static void Run(OfficeBuddyDbContext db, DateOnly today)
    {
        var office = db.Offices.OrderBy(o => o.Id).FirstOrDefault();
        if (office is null)
        {
            return;
        }

        var oids = Names.Select((_, i) => OidFor(i)).ToList();
        var existingPeople = db.People.Where(p => oids.Contains(p.Oid)).Select(p => p.Oid).ToHashSet();
        for (var i = 0; i < Names.Length; i++)
        {
            if (!existingPeople.Contains(oids[i]))
            {
                db.People.Add(new Person { Oid = oids[i], DisplayName = Names[i], HomeOfficeId = office.Id });
            }
        }

        // Last week through three weeks ahead, Monday–Friday.
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var from = monday.AddDays(-7);
        var to = monday.AddDays(25);
        var existingEntries = db.WorkplaceEntries
            .Where(w => oids.Contains(w.PersonOid) && w.Date >= from && w.Date <= to)
            .Select(w => new { w.PersonOid, w.Date })
            .AsEnumerable()
            .Select(w => (w.PersonOid, w.Date))
            .ToHashSet();

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            if (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            {
                continue;
            }

            for (var i = 0; i < Names.Length; i++)
            {
                // Deterministic mix: about half at the office, the rest at home, at a customer
                // or not filled in at all.
                Location? location = ((i * 7 + date.DayNumber * 13) % 20) switch
                {
                    < 10 => Location.Office,
                    < 15 => Location.Home,
                    < 18 => Location.Customer,
                    _ => null,
                };

                if (location is { } value && !existingEntries.Contains((oids[i], date)))
                {
                    db.WorkplaceEntries.Add(new WorkplaceEntry
                    {
                        PersonOid = oids[i],
                        Date = date,
                        Location = value,
                        OfficeId = office.Id,
                    });
                }
            }
        }

        db.SaveChanges();
    }
}
