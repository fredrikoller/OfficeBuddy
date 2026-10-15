using System;
using OfficeBuddy.Api.Data.Enums;

namespace OfficeBuddy.Api.Data.Entities;

public class WorkplaceEntry
{
    public int Id { get; set; }
    public Guid PersonOid { get; set; }
    public Person Person { get; set; } = null!;
    public DateOnly Date { get; set; }
    public Location Location { get; set; }
    public int OfficeId { get; set; }
    public Office Office { get; set; } = null!;
}
