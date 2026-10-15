using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

public record GetOfficesQuery : IQuery<IReadOnlyList<OfficeDto>>;

public class GetOfficesHandler(OfficeBuddyDbContext db) : IRequestHandler<GetOfficesQuery, IReadOnlyList<OfficeDto>>
{
    public async Task<IReadOnlyList<OfficeDto>> HandleAsync(GetOfficesQuery request, CancellationToken ct = default) =>
        await db.Offices
            .OrderBy(o => o.Name)
            .Select(o => new OfficeDto(o.Id, o.Name))
            .ToListAsync(ct);
}
