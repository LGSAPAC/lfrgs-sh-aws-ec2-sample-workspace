<%@ include file="/init.jsp" %>

<p>
	<b><liferay-ui:message key="ec2sample.caption" /></b>
</p>

<%-- In the high-availability setup, refresh the page with sticky sessions cleared to see each node answer. --%>
<p>
	<liferay-ui:message arguments="<%= HtmlUtil.escape(PortalUtil.getComputerName()) %>" key="ec2sample.served-by" />
</p>
