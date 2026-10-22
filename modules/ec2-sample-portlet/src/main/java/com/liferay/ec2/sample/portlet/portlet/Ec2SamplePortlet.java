package com.liferay.ec2.sample.portlet.portlet;

import com.liferay.ec2.sample.portlet.constants.Ec2SamplePortletKeys;

import com.liferay.portal.kernel.portlet.bridges.mvc.MVCPortlet;

import jakarta.portlet.Portlet;

import org.osgi.service.component.annotations.Component;

/**
 * @author chivlengtonylim
 */
@Component(
	property = {
		"com.liferay.portlet.display-category=category.sample",
		"com.liferay.portlet.header-portlet-css=/css/main.css",
		"com.liferay.portlet.instanceable=true",
		"jakarta.portlet.display-name=Ec2Sample",
		"jakarta.portlet.init-param.template-path=/",
		"jakarta.portlet.init-param.view-template=/view.jsp",
		"jakarta.portlet.name=" + Ec2SamplePortletKeys.EC2SAMPLE,
		"jakarta.portlet.resource-bundle=content.Language",
		"jakarta.portlet.security-role-ref=power-user,user"
	},
	service = Portlet.class
)
public class Ec2SamplePortlet extends MVCPortlet {
}
