using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Cqrs;

public interface IRequestHandler<TRequest, TResult>
    where TRequest : IRequest<TResult>
{
    Task<TResult> HandleAsync(TRequest request, CancellationToken ct = default);
}
