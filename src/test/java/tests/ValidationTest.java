package tests;

import generator.ModelGenerator;
import generator.validation.ValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

import java.util.*;

/**
 * Tests for NLP → Model validation (fail-fast behavior).
 * 
 * These tests verify that invalid NLP input is rejected before
 * any EMF model creation, ensuring "correct by construction".
 */
public class ValidationTest {
    
    private ModelGenerator modelGen;
    
    @BeforeEach
    public void setUp() {
        modelGen = new ModelGenerator();
    }
    
    @Test
    public void testMissingResourceType() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> resource = new HashMap<>();
        resource.put("name", "test-resource");
        // Missing "type" field
        resources.add(resource);
        nlpJson.put("resources", resources);
        
        assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        }, "Should reject resource without type");
    }
    
    @Test
    public void testUnsupportedResourceType() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> resource = new HashMap<>();
        resource.put("type", "InvalidResourceType");
        resource.put("name", "test-resource");
        resources.add(resource);
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("Unsupported resource type"));
    }
    
    @Test
    public void testSubnetWithoutVPC() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> subnet = new HashMap<>();
        subnet.put("type", "Subnet");
        subnet.put("name", "test-subnet");
        subnet.put("cidr", "10.0.1.0/24");
        // Missing "vpc" reference
        resources.add(subnet);
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("Subnet") && 
                  (ex.getMessage().contains("must belong") || ex.getMessage().contains("must reference")),
                  "Error message should mention Subnet VPC requirement");
    }
    
    @Test
    public void testSubnetWithNonExistentVPC() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> subnet = new HashMap<>();
        subnet.put("type", "Subnet");
        subnet.put("name", "test-subnet");
        subnet.put("cidr", "10.0.1.0/24");
        subnet.put("vpc", "non-existent-vpc");
        resources.add(subnet);
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("non-existent VPC"));
    }
    
    @Test
    public void testComputeInstanceWithoutSecurityGroup() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> compute = new HashMap<>();
        compute.put("type", "ComputeInstance");
        compute.put("name", "test-server");
        // Missing "securityGroups"
        resources.add(compute);
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("ComputeInstance must reference at least one SecurityGroup"));
    }
    
    @Test
    public void testAutoScalingGroupWithoutTemplate() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        Map<String, Object> asg = new HashMap<>();
        asg.put("type", "AutoScalingGroup");
        asg.put("name", "test-asg");
        asg.put("minSize", 1);
        asg.put("maxSize", 3);
        // Missing "template" reference
        resources.add(asg);
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("AutoScalingGroup") && 
                  ex.getMessage().contains("template"),
                  "Error message should mention AutoScalingGroup template requirement");
    }
    
    @Test
    public void testDuplicateResourceNames() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        
        Map<String, Object> resource1 = new HashMap<>();
        resource1.put("type", "VPC");
        resource1.put("name", "duplicate-name");
        resource1.put("cidr", "10.0.0.0/16");
        resources.add(resource1);
        
        Map<String, Object> resource2 = new HashMap<>();
        resource2.put("type", "VPC");
        resource2.put("name", "duplicate-name"); // Duplicate name
        resource2.put("cidr", "10.0.1.0/16");
        resources.add(resource2);
        
        nlpJson.put("resources", resources);
        
        ValidationException ex = assertThrows(ValidationException.class, () -> {
            modelGen.createModel(nlpJson);
        });
        
        assertTrue(ex.getMessage().contains("Duplicate resource name"));
    }
    
    @Test
    public void testValidModelWithConstraints() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        
        // VPC
        Map<String, Object> vpc = new HashMap<>();
        vpc.put("type", "VPC");
        vpc.put("name", "main-vpc");
        vpc.put("cidr", "10.0.0.0/16");
        resources.add(vpc);
        
        // Subnet (with VPC reference)
        Map<String, Object> subnet = new HashMap<>();
        subnet.put("type", "Subnet");
        subnet.put("name", "public-subnet");
        subnet.put("cidr", "10.0.1.0/24");
        subnet.put("vpc", "main-vpc");
        subnet.put("typeSubnet", "public");
        resources.add(subnet);
        
        // Security Group
        Map<String, Object> sg = new HashMap<>();
        sg.put("type", "SecurityGroup");
        sg.put("name", "web-sg");
        resources.add(sg);
        
        // Compute Instance (with Security Group reference)
        Map<String, Object> compute = new HashMap<>();
        compute.put("type", "ComputeInstance");
        compute.put("name", "web-server");
        compute.put("securityGroups", Arrays.asList("web-sg"));
        resources.add(compute);
        
        nlpJson.put("resources", resources);
        
        // Should not throw
        assertDoesNotThrow(() -> {
            var infra = modelGen.createModel(nlpJson);
            assertNotNull(infra);
            // Subnet is contained in VPC, so count is 3 (VPC, SG, Compute)
            assertEquals(3, infra.getResources().size());
        });
    }
    
    @Test
    public void testSubnetContainmentInVPC() {
        Map<String, Object> nlpJson = new HashMap<>();
        nlpJson.put("provider", "AWS");
        
        List<Map<String, Object>> resources = new ArrayList<>();
        
        // VPC
        Map<String, Object> vpc = new HashMap<>();
        vpc.put("type", "VPC");
        vpc.put("name", "main-vpc");
        vpc.put("cidr", "10.0.0.0/16");
        resources.add(vpc);
        
        // Subnet
        Map<String, Object> subnet = new HashMap<>();
        subnet.put("type", "Subnet");
        subnet.put("name", "public-subnet");
        subnet.put("cidr", "10.0.1.0/24");
        subnet.put("vpc", "main-vpc");
        resources.add(subnet);
        
        nlpJson.put("resources", resources);
        
        var infra = modelGen.createModel(nlpJson);
        
        // Find VPC and Subnet
        var vpcRes = infra.getResources().stream()
            .filter(r -> r instanceof cloudinfragen.VPC)
            .map(r -> (cloudinfragen.VPC) r)
            .findFirst()
            .orElse(null);
        
        assertNotNull(vpcRes, "VPC should exist");
        assertEquals(1, vpcRes.getSubnets().size(), "VPC should contain the subnet");
        assertEquals("public-subnet", vpcRes.getSubnets().get(0).getName());
        
        // Subnet should not be in Infrastructure.resources (it's contained in VPC)
        long subnetCount = infra.getResources().stream()
            .filter(r -> r instanceof cloudinfragen.Subnet)
            .count();
        assertEquals(0, subnetCount, "Subnet should not be in Infrastructure.resources");
    }
}

