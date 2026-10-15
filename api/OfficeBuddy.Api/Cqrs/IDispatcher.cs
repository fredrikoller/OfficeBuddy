using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Cqrs;

public interface IDispatcher
{
    /// <summary>
    /// Resolves the IRequestHandler<,> for the request's runtime type and invokes it
    /// </summary>
    /// <typeparam name="TResult"></typeparam>
    /// <param name="request"></param>
    /// <param name="ct"></param>
    /// <returns></returns>
    Task<TResult> SendAsync<TResult>(IRequest<TResult> request, CancellationToken ct = default);
}
